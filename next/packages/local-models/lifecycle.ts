import { CuratedCatalog } from "./catalog.ts";
import { assessCompatibility } from "./compatibility.ts";
import { LocalModelError, type HardwareSnapshot, type Installation } from "./domain.ts";
import type { ArtifactStore, ModelRegistry } from "./ports.ts";
import type { RuntimeAdapter, RuntimeGeneration, RuntimeHandle } from "./runtime.ts";
import { randomUUID } from "node:crypto";
import { unavailableTelemetry, type RuntimeMeasurement } from "./telemetry.ts";

export interface InstallationGuard {
  withUnboundInstallation<T>(id: string, operation: () => Promise<T>): Promise<T>;
}
type LoadSettings = { contextTokens: number; maximumOutputTokens: number; threads: number };
type Active = { adapter: RuntimeAdapter; handle: RuntimeHandle; estimatedMemoryBytes: number; users: number; settings: LoadSettings };
export class ModelLifecycle {
  supports(runtime: string): boolean { return this.adapters.some(adapter => adapter.kind === runtime); }
  private readonly active = new Map<string, Active>();
  private readonly changing = new Set<string>();
  private readonly removals = new Map<string, { fingerprint: string; pending: Promise<void> }>();
  constructor(private readonly catalog: CuratedCatalog, private readonly registry: ModelRegistry,
    private readonly artifacts: ArtifactStore, private readonly adapters: readonly RuntimeAdapter[],
    private readonly hardware: () => Promise<HardwareSnapshot>, private readonly guard: InstallationGuard) {}
  private installation(id: string): Installation {
    const installation = this.registry.findInstallation(id);
    if (!installation) throw new LocalModelError("installation_not_found", 404);
    return installation;
  }
  async load(id: string, settings: { contextTokens: number; maximumOutputTokens: number; threads: number }, signal: AbortSignal): Promise<RuntimeHandle> {
    if (this.changing.size || this.active.has(id)) throw new LocalModelError("runtime_busy", 409);
    this.changing.add(id);
    try {
      const installation = this.installation(id);
      if (installation.state !== "installed") throw new LocalModelError("installation_unavailable", 409);
      const manifest = this.catalog.find(installation.catalogId, installation.catalogRevision);
      const adapter = this.adapters.find((runtime) => runtime.kind === manifest.runtime);
      if (!adapter) throw new LocalModelError("runtime_unavailable", 503);
      const simultaneous = [...this.active.values()].reduce((sum, value) => sum + value.estimatedMemoryBytes, 0);
      const compatibility = assessCompatibility(manifest, await this.hardware(), {
        contextTokens: settings.contextTokens, enabledCapabilities: manifest.capabilities, simultaneousMemoryBytes: simultaneous,
      }, manifest.files.reduce((sum, file) => sum + file.bytes, 0) * 2);
      if (compatibility.verdict === "incompatible") throw new LocalModelError("hardware_incompatible", 409);
      if (compatibility.reasonCodes.includes("unknown-memory")) throw new LocalModelError("hardware_unknown", 409);
      const files = [];
      for (const file of manifest.files) {
        if (!await this.artifacts.has(file)) throw new LocalModelError("artifact_missing", 409);
        files.push({ role: file.role, path: await this.artifacts.path(file.sha256) });
      }
      const handle = await adapter.load({ installationId: id, manifest, files, ...settings }, signal);
      this.active.set(id, { adapter, handle, estimatedMemoryBytes: compatibility.estimatedMemoryBytes - simultaneous, users: 0, settings: { ...settings } });
      return handle;
    } finally { this.changing.delete(id); }
  }
  private current(id: string): Active {
    const active = this.active.get(id);
    if (!active || this.changing.has(id)) throw new LocalModelError("runtime_not_loaded", 409);
    return active;
  }
  async generate(id: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<string> {
    const active = this.current(id); active.users++;
    try { return await active.adapter.generate(active.handle.id, operationId, input, signal); }
    finally { active.users--; }
  }
  async transcribe(id: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<string> {
    const active = this.current(id); active.users++;
    try { return await active.adapter.transcribe(active.handle.id, operationId, audio, language, signal); }
    finally { active.users--; }
  }
  async measureGeneration(id: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<RuntimeMeasurement> {
    const active = this.current(id); active.users++;
    try {
      if (active.adapter.measureGeneration) return await active.adapter.measureGeneration(active.handle.id, operationId, input, signal);
      return { output: await active.adapter.generate(active.handle.id, operationId, input, signal),
        telemetry: unavailableTelemetry("runtime-measurement-unsupported") };
    } finally { active.users--; }
  }
  async measureTranscription(id: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<RuntimeMeasurement> {
    const active = this.current(id); active.users++;
    try {
      if (active.adapter.measureTranscription) return await active.adapter.measureTranscription(active.handle.id, operationId, audio, language, signal);
      return { output: await active.adapter.transcribe(active.handle.id, operationId, audio, language, signal),
        telemetry: unavailableTelemetry("runtime-measurement-unsupported") };
    } finally { active.users--; }
  }
  cancel(operationId: string): void { for (const active of this.active.values()) active.adapter.cancel(operationId); }
  retain(id: string): () => void {
    const active = this.current(id);
    active.users++;
    let released = false;
    return () => { if (!released) { released = true; active.users--; } };
  }
  async unload(id: string): Promise<void> {
    const active = this.current(id);
    if (active.users) throw new LocalModelError("runtime_in_use", 409);
    this.changing.add(id);
    try { await active.adapter.unload(active.handle.id); this.active.delete(id); }
    finally { this.changing.delete(id); }
  }
  remove(id: string, expectedRevision: number, requestId: string = randomUUID()): Promise<void> {
    const fingerprint = JSON.stringify([id, expectedRevision]);
    const existing = this.removals.get(requestId);
    if (existing) return existing.fingerprint === fingerprint ? existing.pending : Promise.reject(new LocalModelError("request_conflict", 409));
    const pending = this.removeInstallation(id, expectedRevision, requestId).finally(() => { this.removals.delete(requestId); });
    this.removals.set(requestId, { fingerprint, pending });
    return pending;
  }
  private async removeInstallation(id: string, expectedRevision: number, requestId: string): Promise<void> {
    if (this.changing.has(id)) throw new LocalModelError("installation_busy", 409);
    await this.guard.withUnboundInstallation(id, async () => {
      const active = this.active.get(id);
      if (active?.users) throw new LocalModelError("runtime_in_use", 409);
      if (active) await this.unload(id);
      this.changing.add(id);
      try {
        const journal = this.registry.beginRemoval({ requestId, installationId: id, expectedRevision, lease: randomUUID(), now: Date.now() });
        if (journal.state === "completed") return;
        try {
          for (const hash of this.registry.removableArtifacts(id)) await this.artifacts.remove(hash);
          this.registry.finishRemoval(requestId, journal.lease, true, Date.now());
        } catch (error) {
          this.registry.finishRemoval(requestId, journal.lease, false, Date.now());
          throw error;
        }
      } finally { this.changing.delete(id); }
    });
  }
  status(): { installationId: string; handle: RuntimeHandle; inUse: boolean; settings: LoadSettings }[] {
    return [...this.active.values()].map(({ handle, users, settings }) => ({ installationId: handle.installationId,
      handle: structuredClone(handle), inUse: users > 0, settings: { ...settings } }));
  }
}
