import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import { LocalModelError } from "./domain.ts";
import { processCompletion, spawnRuntime, stopOwnedProcess, verifyRuntime } from "./process.ts";
import type { RuntimeAdapter, RuntimeBinary, RuntimeGeneration, RuntimeHandle, RuntimeLoad } from "./runtime.ts";
import { sampleOwnedMemory, type MemorySampler } from "./memory-sampler.ts";
import { unavailableTelemetry, type RuntimeMeasurement } from "./telemetry.ts";
import { readLlamaStream } from "./llama-stream.ts";

type Loaded = { handle: RuntimeHandle; child: ChildProcess; url: string; token: string; directory: string; outputTokens: number; users: number; disableThinking: boolean; cpuOnly: boolean };
export function llamaProcessArguments(configuration: RuntimeLoad, weights: string, port: number, keyFile: string, alias: string) {
  const batch = Math.min(256, configuration.contextTokens);
  const argumentsList = ["-m", weights, "--host", "127.0.0.1", "--port", String(port),
    "--api-key-file", keyFile, "--alias", alias, "-c", String(configuration.contextTokens),
    "-t", String(configuration.threads), "--n-gpu-layers", "0", "--device", "none", "--no-op-offload", "--no-kv-offload", "--parallel", "1",
    "--batch-size", String(batch), "--ubatch-size", String(Math.min(128, batch))];
  const projector = configuration.files.find((file) => file.role === "projector");
  if (projector) argumentsList.push("--mmproj", projector.path, "--no-mmproj-offload");
  return argumentsList;
}
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new LocalModelError("runtime_port_unavailable");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}
export class LlamaRuntime implements RuntimeAdapter {
  readonly kind = "llama.cpp" as const;
  private loaded: Loaded | null = null;
  private loading = false;
  private readonly operations = new Map<string, AbortController>();
  constructor(private readonly binary: RuntimeBinary, private readonly request: typeof fetch = fetch,
    private readonly memory: (child: ChildProcess) => MemorySampler = sampleOwnedMemory) {}
  async load(configuration: RuntimeLoad, signal: AbortSignal): Promise<RuntimeHandle> {
    if (this.loaded || this.loading) throw new LocalModelError("runtime_busy", 409);
    if (configuration.manifest.runtime !== this.kind || configuration.contextTokens < 1 ||
      configuration.contextTokens > configuration.manifest.maximumContext || configuration.threads < 1 ||
      configuration.threads > 128 || configuration.maximumOutputTokens < 1 || configuration.maximumOutputTokens > 8192)
      throw new LocalModelError("runtime_configuration_invalid");
    this.loading = true;
    let child: ChildProcess | undefined;
    let directory: string | undefined;
    try {
      await verifyRuntime(this.binary);
      signal.throwIfAborted();
      const weights = configuration.files.find((file) => file.role === "weights");
      if (!weights) throw new LocalModelError("model_weights_missing");
      directory = await mkdtemp(join(tmpdir(), "orvunia-llama-"));
      const token = randomUUID();
      const keyFile = join(directory, "access.key");
      await writeFile(keyFile, token, { mode: 0o600, flag: "wx" });
      const port = await freePort();
      const handle: RuntimeHandle = { id: randomUUID(), installationId: configuration.installationId,
        runtime: this.kind, capabilities: configuration.manifest.capabilities };
      const argumentsList = llamaProcessArguments(configuration, weights.path, port, keyFile, handle.id);
      child = spawnRuntime(this.binary, argumentsList, directory);
      let exited = false;
      void processCompletion(child).then(() => { exited = true; }, () => { exited = true; });
      const url = `http://127.0.0.1:${port}`;
      const timeout = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
      for (;;) {
        timeout.throwIfAborted();
        if (exited) throw new LocalModelError("runtime_exited", 503);
        const response = await this.request(`${url}/v1/models`, { headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.any([timeout, AbortSignal.timeout(1000)]) }).catch(() => null);
        if (response?.ok) {
          const models = await response.json() as { data?: { id?: string }[] };
          if (models.data?.some((model) => model.id === handle.id)) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      this.loaded = { handle, child, url, token, directory, outputTokens: configuration.maximumOutputTokens,
        users: 0, disableThinking: configuration.manifest.architecture.startsWith("qwen3"), cpuOnly: true };
      return structuredClone(handle);
    } catch (error) {
      if (child) await stopOwnedProcess(child);
      if (directory) await rm(directory, { recursive: true, force: true });
      throw error;
    } finally { this.loading = false; }
  }
  private current(id: string): Loaded {
    if (!this.loaded || this.loaded.handle.id !== id || this.loaded.child.exitCode !== null || this.loaded.child.signalCode !== null)
      throw new LocalModelError("runtime_not_loaded", 409);
    return this.loaded;
  }
  async generate(id: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<string> {
    return (await this.complete(id, operationId, input, signal, false)).output;
  }
  async measureGeneration(id: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<RuntimeMeasurement> {
    return this.complete(id, operationId, input, signal, true);
  }
  private async complete(id: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal, measured: boolean): Promise<RuntimeMeasurement> {
    const loaded = this.current(id);
    if (this.operations.size || this.operations.has(operationId)) throw new LocalModelError("runtime_busy", 409);
    if (input.images.length > 3 || input.images.some((image) => image.data.length > 8 * 1024 ** 2) ||
      (input.images.length && !loaded.handle.capabilities.includes("vision"))) throw new LocalModelError("vision_unavailable");
    const controller = new AbortController();
    this.operations.set(operationId, controller); loaded.users++;
    let memory: MemorySampler | undefined;
    try {
      if (measured) memory = this.memory(loaded.child);
      const content = [{ type: "text", text: input.prompt }, ...input.images.map((image) => ({
        type: "image_url", image_url: { url: `data:${image.mime};base64,${Buffer.from(image.data).toString("base64")}` },
      }))];
      const combined = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(180_000)]);
      const started = performance.now();
      const response = await this.request(`${loaded.url}/v1/chat/completions`, {
        method: "POST", headers: { Authorization: `Bearer ${loaded.token}`, "Content-Type": "application/json" },
        signal: combined,
        body: JSON.stringify({ model: loaded.handle.id, max_tokens: loaded.outputTokens, stream: measured,
          ...(measured ? { stream_options: { include_usage: true }, timings_per_token: true } : {}),
          ...(loaded.disableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages: [{ role: "system", content: input.instructions }, { role: "user", content }] }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new LocalModelError("local_generation_failed", 502); }
      if (measured) {
        const result = await readLlamaStream(response, combined, started);
        const latencyMilliseconds = performance.now() - started;
        const resident = await memory!.stop(); memory = undefined;
        Object.assign(result.telemetry, { residentMemoryBytes: resident.bytes, memorySamples: resident.samples,
          vramBytes: loaded.cpuOnly ? 0 : null });
        result.telemetry.provenance.residentMemory = resident.source;
        result.telemetry.provenance.vram = loaded.cpuOnly ? "policy-cpu-disabled" : null;
        result.telemetry.unavailableReasons.push(...resident.unavailableReasons,
          ...(!loaded.cpuOnly ? ["vram:cpu-policy-unconfirmed"] : []));
        return { ...result, latencyMilliseconds };
      }
      const result = await response.json() as { choices?: { message?: { content?: string } }[] };
      const text = result.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim() || text.length > 128 * 1024) throw new LocalModelError("local_generation_invalid", 502);
      return { output: text, telemetry: unavailableTelemetry("measurement-not-requested") };
    } finally {
      try { await memory?.stop(); } finally { this.operations.delete(operationId); loaded.users--; }
    }
  }
  async transcribe(): Promise<string> { throw new LocalModelError("capability_unavailable"); }
  cancel(operationId: string): void { this.operations.get(operationId)?.abort(); }
  async unload(id: string): Promise<void> {
    const loaded = this.loaded;
    if (!loaded || loaded.handle.id !== id) throw new LocalModelError("runtime_not_loaded", 409);
    if (loaded.users) throw new LocalModelError("runtime_in_use", 409);
    this.loaded = null;
    await stopOwnedProcess(loaded.child);
    await rm(loaded.directory, { recursive: true, force: true });
  }
  async health(id: string): Promise<boolean> {
    try { const loaded = this.current(id); return (await this.request(`${loaded.url}/health`, { signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  }
}
