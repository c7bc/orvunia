import { randomUUID } from "node:crypto";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { ModelLifecycle } from "../../packages/local-models/lifecycle.ts";
import { ModelBenchmarks } from "../../packages/local-models/benchmarks/service.ts";
import { SqliteBenchmarks } from "../../packages/local-models/benchmarks/store.ts";
import type { Capability } from "../../packages/local-models/domain.ts";
import type { RuntimeAdapter, RuntimeGeneration } from "../../packages/local-models/runtime.ts";
import { benchmarkFixtures } from "../../packages/local-models/benchmarks/fixtures.ts";
import { modelFixture, syntheticTransport } from "./local-models.ts";

export function deferred<Value = void>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>(complete => { resolve = complete; });
  return { promise, resolve };
}
export async function until(check: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw Error("Controlled benchmark did not reach expected state");
    await Bun.sleep(1);
  }
}
export async function benchmarkFixture(capabilities: Capability[] = ["text"]) {
  const fixture = await modelFixture();
  fixture.manifest.capabilities = capabilities;
  const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts,
    syntheticTransport("synthetic-model-integrity-fixture"));
  const job = downloads.create({ requestId: randomUUID(), catalogId: fixture.manifest.id, revision: fixture.manifest.revision });
  await downloads.run(job.id);
  const calls: { input: RuntimeGeneration | Uint8Array; signal: AbortSignal; language: string | null }[] = [];
  let invoke: (signal: AbortSignal) => Promise<void> = async () => undefined;
  let unloads = 0;
  const adapter: RuntimeAdapter = { kind: "llama.cpp",
    async load() { return { id: randomUUID(), installationId: job.installationId, runtime: "llama.cpp", capabilities }; },
    async generate(_handle, _operation, input, signal) {
      calls.push({ input, signal, language: null }); await invoke(signal);
      return input.images.length ? "[4,8,12]" : "[3,1,2]";
    },
    async transcribe(_handle, _operation, input, language, signal) {
      calls.push({ input, signal, language }); await invoke(signal);
      return benchmarkFixtures(["transcription"]).find(entry => entry.language === language)!.reference;
    }, cancel() {}, async unload() { unloads++; }, async health() { return true; },
  };
  const lifecycle = new ModelLifecycle(fixture.catalog, fixture.registry, fixture.artifacts, [adapter], async () => ({
    measuredAt: new Date().toISOString(), architecture: "x64", processors: 4, totalMemoryBytes: 8 * 1024 ** 3,
    availableMemoryBytes: 6 * 1024 ** 3, freeDiskBytes: 8 * 1024 ** 3, acceleration: "cpu", unavailableFields: [],
  }), { async withUnboundInstallation(_id, operation) { return operation(); } });
  const store = new SqliteBenchmarks(fixture.database);
  const binary = { path: "controlled-not-executable", sha256: "b".repeat(64), version: "controlled-runtime" };
  const service = (timeoutMilliseconds = 120_000) => new ModelBenchmarks({ store,
    registry: fixture.registry, catalog: fixture.catalog, engine: lifecycle, runtimes: { llama: binary }, timeoutMilliseconds });
  return { ...fixture, installationId: job.installationId, calls, lifecycle, store, service, adapter,
    hook(operation: (signal: AbortSignal) => Promise<void>) { invoke = operation; },
    unloads: () => unloads,
    load: () => lifecycle.load(job.installationId, { contextTokens: 128, maximumOutputTokens: 128, threads: 2 }, new AbortController().signal),
  };
}
