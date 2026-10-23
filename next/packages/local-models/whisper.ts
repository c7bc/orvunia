import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalModelError } from "./domain.ts";
import { processCompletion, spawnRuntime, stopOwnedProcess, verifyRuntime } from "./process.ts";
import type { RuntimeAdapter, RuntimeBinary, RuntimeHandle, RuntimeLoad } from "./runtime.ts";
import { isDigitalSilence } from "./wave.ts";
import { normalizeWhisperText } from "./whisper-text.ts";
import { WhisperAdmission } from "./whisper-admission.ts";
import { sampleOwnedMemory, type MemorySampler } from "./memory-sampler.ts";
import { unavailableTelemetry, type RuntimeMeasurement } from "./telemetry.ts";

export class WhisperRuntime implements RuntimeAdapter {
  readonly kind = "whisper.cpp" as const;
  private loaded: { handle: RuntimeHandle; weights: string; threads: number; users: number } | null = null;
  private loading = false;
  private readonly admission = new WhisperAdmission();
  constructor(private readonly binary: RuntimeBinary, private readonly memory: (child: import("node:child_process").ChildProcess) => MemorySampler = sampleOwnedMemory) {}
  async load(configuration: RuntimeLoad, signal: AbortSignal): Promise<RuntimeHandle> {
    if (this.loaded || this.loading) throw new LocalModelError("runtime_busy", 409);
    if (configuration.manifest.runtime !== this.kind || !Number.isInteger(configuration.threads) ||
      configuration.threads < 1 || configuration.threads > 128) throw new LocalModelError("runtime_configuration_invalid");
    this.loading = true;
    try {
      await verifyRuntime(this.binary);
      signal.throwIfAborted();
      const weights = configuration.files.find((file) => file.role === "weights");
      if (!weights) throw new LocalModelError("model_weights_missing");
      const handle: RuntimeHandle = { id: randomUUID(), installationId: configuration.installationId,
        runtime: this.kind, capabilities: ["transcription"] };
      this.loaded = { handle, weights: weights.path, threads: configuration.threads, users: 0 };
      return structuredClone(handle);
    } finally { this.loading = false; }
  }
  async transcribe(handleId: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<string> {
    return (await this.transcribeResult(handleId, operationId, audio, language, signal, false)).output;
  }
  async measureTranscription(handleId: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<RuntimeMeasurement> {
    return this.transcribeResult(handleId, operationId, audio, language, signal, true);
  }
  private async transcribeResult(handleId: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal, measured: boolean): Promise<RuntimeMeasurement> {
    const loaded = this.loaded;
    if (!loaded || loaded.handle.id !== handleId) throw new LocalModelError("runtime_not_loaded", 409);
    if (!["auto", "pt", "en", "es"].includes(language)) throw new LocalModelError("local_language_unsupported");
    signal.throwIfAborted();
    if (isDigitalSilence(audio)) return { output: "", telemetry: unavailableTelemetry("transcription:silence-without-runtime-invocation") };
    const operation = this.admission.acquire(operationId, signal);
    const combined = operation.signal;
    loaded.users++;
    let directory: string | undefined;
    try {
      await operation.ready;
      combined.throwIfAborted();
      directory = await mkdtemp(join(tmpdir(), "orvunia-whisper-"));
      combined.throwIfAborted();
      const input = join(directory, "input.wav");
      const output = join(directory, "transcript");
      await writeFile(input, audio, { flag: "wx", mode: 0o600 });
      await verifyRuntime(this.binary);
      combined.throwIfAborted();
      const started = performance.now();
      const child = spawnRuntime(this.binary, ["-m", loaded.weights, "-f", input, "-l", language,
        "-t", String(loaded.threads), "-nt", "-otxt", "-of", output, ...(measured ? ["--no-gpu"] : [])], directory);
      const completion = processCompletion(child);
      let memory: MemorySampler | null = null;
      const abort = () => { void stopOwnedProcess(child); };
      combined.addEventListener("abort", abort, { once: true });
      try {
        if (measured) memory = this.memory(child);
        const exit = await completion;
        combined.throwIfAborted();
        if (exit !== 0) throw new LocalModelError("local_transcription_failed", 502);
        const result = await readFile(`${output}.txt`);
        if (result.length > 128 * 1024) throw new LocalModelError("local_transcription_invalid", 502);
        const text = normalizeWhisperText(result.toString("utf8"));
        const latencyMilliseconds = performance.now() - started;
        const telemetry = unavailableTelemetry("measurement-not-requested");
        if (memory) {
          const resident = await memory.stop();
          memory = null;
          Object.assign(telemetry, { residentMemoryBytes: resident.bytes, memorySamples: resident.samples, vramBytes: 0,
            unavailableReasons: ["time-to-first-token:not-applicable-transcription", "tokens-per-second:not-applicable-transcription",
              ...resident.unavailableReasons] });
          telemetry.provenance.residentMemory = resident.source;
          telemetry.provenance.vram = "policy-cpu-disabled";
        }
        return { output: text, telemetry, latencyMilliseconds };
      } finally {
        combined.removeEventListener("abort", abort);
        try { await memory?.stop(); } finally { await stopOwnedProcess(child); }
      }
    } finally {
      try { if (directory) await rm(directory, { recursive: true, force: true }); }
      finally { loaded.users--; operation.release(); }
    }
  }
  async generate(): Promise<string> { throw new LocalModelError("capability_unavailable"); }
  cancel(operationId: string): void { this.admission.cancel(operationId); }
  async unload(handleId: string): Promise<void> {
    if (!this.loaded || this.loaded.handle.id !== handleId) throw new LocalModelError("runtime_not_loaded", 409);
    if (this.loaded.users) throw new LocalModelError("runtime_in_use", 409);
    this.loaded = null;
  }
  async health(handleId: string): Promise<boolean> {
    return this.loaded?.handle.id === handleId;
  }
}
