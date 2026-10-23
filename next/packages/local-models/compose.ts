import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { CuratedCatalog } from "./catalog.ts";
import { FileArtifacts } from "./artifacts.ts";
import { ModelDownloads } from "./downloads.ts";
import { LocalModelError, type Capability } from "./domain.ts";
import { probeHardware } from "./hardware.ts";
import { ModelImports } from "./imports.ts";
import { ModelLifecycle } from "./lifecycle.ts";
import { LlamaRuntime } from "./llama.ts";
import { SqliteModelRegistry } from "./registry.ts";
import type { RuntimeAdapter, RuntimeBinary } from "./runtime.ts";
import { NativeModelSelections } from "./selections.ts";
import { HttpsModelTransport } from "./transport.ts";
import { WhisperRuntime } from "./whisper.ts";
import { modelQueue } from "./queue.ts";
import { ModelBenchmarks } from "./benchmarks/service.ts";
import { SqliteBenchmarks } from "./benchmarks/store.ts";
import { closeLocalModels } from "./shutdown.ts";

export function composeLocalModels(input: {
  directory: string;
  database: Database;
  bindings: () => Promise<string[]>;
  runtimes?: { llama?: RuntimeBinary; whisper?: RuntimeBinary };
}) {
  const catalog = new CuratedCatalog();
  const registry = new SqliteModelRegistry(input.database);
  const artifacts = new FileArtifacts(join(input.directory, "models"));
  const downloads = new ModelDownloads(catalog, registry, artifacts, new HttpsModelTransport());
  const queue = modelQueue(downloads, registry);
  const selections = new NativeModelSelections();
  const imports = new ModelImports(catalog, registry, artifacts, selections);
  const hardware = () => probeHardware(input.directory);
  const adapters: RuntimeAdapter[] = [];
  if (input.runtimes?.llama) adapters.push(new LlamaRuntime(input.runtimes.llama));
  if (input.runtimes?.whisper) adapters.push(new WhisperRuntime(input.runtimes.whisper));
  let mutation = Promise.resolve();
  async function withConfigurationMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = mutation;
    let release: () => void = () => undefined;
    mutation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  const lifecycle = new ModelLifecycle(catalog, registry, artifacts, adapters, hardware, {
    withUnboundInstallation: (id, operation) => withConfigurationMutation(async () => {
      if ((await input.bindings()).includes(id)) throw new LocalModelError("installation_bound", 409);
      return operation();
    }),
  });
  const benchmarks = new ModelBenchmarks({ store: new SqliteBenchmarks(input.database), registry, catalog,
    engine: lifecycle, runtimes: input.runtimes ?? {} });
  async function installationSupports(id: string, capability: Capability): Promise<boolean> {
    const installation = registry.findInstallation(id);
    if (!installation || installation.state !== "installed") return false;
    const manifest = catalog.find(installation.catalogId, installation.catalogRevision);
    if (!manifest.capabilities.includes(capability)) return false;
    for (const file of manifest.files) if (!await artifacts.has(file)) return false;
    return true;
  }
  return {
    service: { catalog, registry, artifacts, downloads, imports, lifecycle, hardware, selections, queue, benchmarks,
      listJobs: () => registry.listJobs(), listInstallations: () => registry.listInstallations() },
    installationSupports, withConfigurationMutation,
    async close() {
      await closeLocalModels({ benchmarks, queue, imports, lifecycle });
    },
  };
}
export type LocalModelComposition = ReturnType<typeof composeLocalModels>;
