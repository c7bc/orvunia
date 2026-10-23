import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { FileArtifacts } from "../../packages/local-models/artifacts.ts";
import { SqliteModelRegistry } from "../../packages/local-models/registry.ts";
import { localModelSchema } from "../../packages/local-models/schema.ts";
import { modelRemovalSchema } from "../../packages/local-models/removal-schema.ts";
import { modelRequestSchema } from "../../packages/local-models/request-schema.ts";
import { benchmarkSchema } from "../../packages/local-models/benchmarks/schema.ts";
import type { ModelManifest } from "../../packages/local-models/domain.ts";
import type { DownloadTransport } from "../../packages/local-models/ports.ts";

export function syntheticManifest(contents = "synthetic-model-integrity-fixture"): ModelManifest {
  return { id: "synthetic", revision: "a".repeat(40), name: "Integrity fixture, not an inference model",
    capabilities: ["text"], runtime: "llama.cpp", architecture: "synthetic", format: "gguf", quantization: "test",
    license: { name: "test", url: "https://example.test/license" }, source: "https://huggingface.co/test/test",
    maximumContext: 4096, evaluation: "not-verified",
    memory: { calibrated: false, fixedBytes: 1024, bytesPerContextToken: 4, visualBytes: 0 },
    files: [{ role: "weights", bytes: Buffer.byteLength(contents), sha256: createHash("sha256").update(contents).digest("hex"),
      url: "https://huggingface.co/test/test/resolve/fixed/model.gguf" }] };
}
export function syntheticTransport(contents: string): DownloadTransport {
  return { async open(file, offset) {
    const bytes = Buffer.from(contents).subarray(offset);
    return { status: offset ? 206 : 200, etag: '"fixed"', contentRange: offset ? `bytes ${offset}-${file.bytes - 1}/${file.bytes}` : null,
      body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) };
  } };
}
export async function modelFixture(contents = "synthetic-model-integrity-fixture") {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-model-test-"));
  const database = new Database(join(directory, "models.sqlite"));
  database.exec("PRAGMA foreign_keys = ON"); database.exec(localModelSchema);
  database.exec(modelRemovalSchema);
  database.exec(modelRequestSchema);
  database.exec(benchmarkSchema);
  const registry = new SqliteModelRegistry(database);
  const artifacts = new FileArtifacts(join(directory, "artifacts"));
  const manifest = syntheticManifest(contents);
  const catalog = new CuratedCatalog([manifest]);
  return { directory, database, registry, artifacts, manifest, catalog, requestId: randomUUID(),
    async close() { database.close(); await rm(directory, { recursive: true, force: true }); } };
}
