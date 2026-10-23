import { randomUUID } from "node:crypto";
import { LocalModelError, type ModelManifest } from "../domain.ts";
import type { ModelRegistry } from "../ports.ts";
import type { RuntimeBinary } from "../runtime.ts";
import { activeBenchmarkStates, type BenchmarkJob } from "./types.ts";
import { fixtureVersion } from "./fixtures.ts";
import type { BenchmarkStore } from "./ports.ts";
import { runBenchmark, type BenchmarkEngine } from "./runner.ts";

type Dependencies = {
  store: BenchmarkStore;
  registry: Pick<ModelRegistry, "findInstallation">;
  catalog: { find(id: string, revision: string): ModelManifest };
  engine: BenchmarkEngine;
  runtimes: { llama?: RuntimeBinary; whisper?: RuntimeBinary };
  timeoutMilliseconds?: number;
};
type Pending = { actor: string; job: BenchmarkJob; controller: AbortController; done: Promise<void>; release: () => void };
export class ModelBenchmarks {
  private pending: Pending | null = null;
  private closing = false;
  private persistenceFailed = false;
  constructor(private readonly dependencies: Dependencies) { dependencies.store.interrupt(Date.now()); }
  create(actor: string, installationId: string, input: { requestId: string; consent: boolean }): BenchmarkJob {
    if (!input.consent) throw new LocalModelError("benchmark_consent_required", 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId))
      throw new LocalModelError("invalid_input", 400);
    const existing = this.dependencies.store.findRequest(actor, input.requestId);
    if (existing) {
      if (existing.installationId !== installationId) throw new LocalModelError("request_conflict", 409);
      return existing;
    }
    if (this.persistenceFailed) throw new LocalModelError("benchmark_persistence_failed", 503);
    if (this.pending || this.closing) throw new LocalModelError("benchmark_busy", 409);
    const installation = this.dependencies.registry.findInstallation(installationId);
    if (!installation || installation.state !== "installed") throw new LocalModelError("installation_not_found", 404);
    const active = this.dependencies.engine.status().find(entry => entry.installationId === installationId);
    if (!active) throw new LocalModelError("benchmark_not_loaded", 409);
    if (active.inUse) throw new LocalModelError("benchmark_busy", 409);
    const runtime = active.handle.runtime === "llama.cpp" ? this.dependencies.runtimes.llama : this.dependencies.runtimes.whisper;
    if (!runtime) throw new LocalModelError("runtime_unavailable", 503);
    const job: BenchmarkJob = { id: randomUUID(), requestId: input.requestId, installationId,
      state: "queued", revision: 1, createdAt: Date.now(), startedAt: null, finishedAt: null, result: null, error: null,
      snapshot: { manifest: structuredClone(this.dependencies.catalog.find(installation.catalogId, installation.catalogRevision)),
        runtime: { kind: active.handle.runtime, version: runtime.version, sha256: runtime.sha256 },
        settings: { ...active.settings }, fixtureVersion } };
    const release = this.dependencies.engine.retain(installationId);
    try { this.dependencies.store.create(actor, job); } catch (error) { release(); throw error; }
    const pending: Pending = { actor, job, controller: new AbortController(), release, done: Promise.resolve() };
    this.pending = pending;
    pending.done = Promise.resolve().then(() => this.execute(pending)).catch(() => {
      this.persistenceFailed = true;
      throw new LocalModelError("benchmark_persistence_failed", 503);
    });
    // HTTP start returns immediately; cancellation/shutdown still observe failures through done.
    void pending.done.catch(() => undefined);
    return structuredClone(job);
  }
  list(actor: string, installationId: string): BenchmarkJob[] { return this.dependencies.store.list(actor, installationId); }
  private update(pending: Pending, changes: Partial<BenchmarkJob>): void {
    const changed = { ...pending.job, ...changes, revision: pending.job.revision + 1 };
    this.dependencies.store.replace(changed);
    pending.job = changed;
  }
  private async execute(pending: Pending): Promise<void> {
    const timeout = setTimeout(() => pending.controller.abort(new Error("benchmark_timeout")),
      Math.max(0, (this.dependencies.timeoutMilliseconds ?? 120_000) - (Date.now() - pending.job.createdAt)));
    timeout.unref?.();
    try {
      pending.controller.signal.throwIfAborted();
      this.update(pending, { state: "running", startedAt: Date.now() });
      const result = await runBenchmark(this.dependencies.engine, pending.job, pending.controller.signal,
        result => this.update(pending, { result }));
      this.update(pending, { state: "completed", result, finishedAt: Date.now() });
    } catch (error) {
      const reason: unknown = pending.controller.signal.reason;
      const timeoutReached = reason instanceof Error && reason.message === "benchmark_timeout";
      const cancelled = pending.controller.signal.aborted && !timeoutReached;
      const code = timeoutReached ? "benchmark_timeout" : cancelled ? "benchmark_cancelled"
        : error instanceof LocalModelError ? error.code : "benchmark_failed";
      this.update(pending, { state: cancelled ? "cancelled" : "failed", error: { code }, finishedAt: Date.now() });
    } finally {
      clearTimeout(timeout);
      pending.release();
      if (this.pending === pending) this.pending = null;
    }
  }
  async cancel(actor: string, id: string): Promise<BenchmarkJob> {
    const job = this.dependencies.store.find(actor, id);
    if (!job) throw new LocalModelError("benchmark_not_found", 404);
    const pending = this.pending;
    if (activeBenchmarkStates.includes(job.state) && pending?.job.id === id) {
      try {
        if (pending.job.state !== "cancelling") this.update(pending, { state: "cancelling" });
      } catch {
        this.persistenceFailed = true;
      } finally { pending.controller.abort(new Error("benchmark_cancelled")); }
      await pending.done;
      if (this.persistenceFailed) throw new LocalModelError("benchmark_persistence_failed", 503);
    }
    return this.dependencies.store.find(actor, id)!;
  }
  async close(): Promise<void> {
    this.closing = true;
    const pending = this.pending;
    if (pending) await this.cancel(pending.actor, pending.job.id);
    if (this.persistenceFailed) throw new LocalModelError("benchmark_persistence_failed", 503);
  }
}
