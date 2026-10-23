import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { ModelImports } from "../../packages/local-models/imports.ts";
import { ModelLifecycle } from "../../packages/local-models/lifecycle.ts";
import { NativeModelSelections } from "../../packages/local-models/selections.ts";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { localModelRoutes } from "../../apps/api/local-models.ts";
import { errorResponse } from "../../packages/http/errors.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

test("retirement blocks new jobs and stale queued/resumable downloads without network or deleting data", async () => {
  const fixture = await modelFixture("preserved-model");
  try {
    const original = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("preserved-model"));
    const pending = original.create({ requestId: randomUUID(), catalogId: fixture.manifest.id, revision: fixture.manifest.revision });
    await fixture.artifacts.write(pending.id, fixture.manifest.files[0]!, Buffer.from("pre"), 0);
    const retired = new CuratedCatalog([{ ...fixture.manifest, availability: "retired" }]);
    let networkCalls = 0;
    const guarded = new ModelDownloads(retired, fixture.registry, fixture.artifacts, {
      async open() { networkCalls++; throw Error("Retired model must not download"); },
    });
    expect(() => guarded.create({ requestId: randomUUID(), catalogId: fixture.manifest.id, revision: fixture.manifest.revision }))
      .toThrow("model_retired");
    expect(fixture.registry.listJobs()).toHaveLength(1);
    expect(guarded.create({ requestId: pending.requestId, catalogId: fixture.manifest.id, revision: fixture.manifest.revision }).id).toBe(pending.id);
    expect(() => guarded.enqueue(pending.id)).toThrow("model_retired");
    const result = await guarded.run(pending.id);
    expect(result).toMatchObject({ state: "failed", errorCode: "model_retired", retryable: false });
    expect(networkCalls).toBe(0);
    expect((await fixture.artifacts.partial(pending.id, fixture.manifest.files[0]!)).bytes).toBe(3);
    expect(fixture.registry.listInstallations()).toEqual([]);
  } finally { await fixture.close(); }
});

test("installed retired revisions retain receipts, exact artifacts, load/unload and explicit removal", async () => {
  const fixture = await modelFixture("preserved-model");
  try {
    const input = { requestId: randomUUID(), catalogId: fixture.manifest.id, revision: fixture.manifest.revision };
    const original = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("preserved-model"));
    const job = original.create(input); await original.run(job.id);
    const catalog = new CuratedCatalog([{ ...fixture.manifest, availability: "retired" }]);
    const guarded = new ModelDownloads(catalog, fixture.registry, fixture.artifacts, { async open() { throw Error("No new transfer"); } });
    expect(guarded.create(input).id).toBe(job.id);
    expect(guarded.create({ ...input, requestId: randomUUID() }).id).toBe(job.id);
    expect((await guarded.run(job.id)).state).toBe("installed");
    const artifact = await fixture.artifacts.path(fixture.manifest.files[0]!.sha256);
    expect(await readFile(artifact, "utf8")).toBe("preserved-model");
    let unloaded = 0;
    const lifecycle = new ModelLifecycle(catalog, fixture.registry, fixture.artifacts, [{ kind: "llama.cpp",
      async load() { return { id: "synthetic-handle", installationId: job.installationId, runtime: "llama.cpp", capabilities: ["text"] }; },
      async unload() { unloaded++; }, async health() { return true; }, cancel() {},
      async generate() { throw Error("No inference"); }, async transcribe() { throw Error("No inference"); },
    }], async () => ({ measuredAt: new Date().toISOString(), architecture: "x64", processors: 4,
      totalMemoryBytes: 8 * 1024 ** 3, availableMemoryBytes: 6 * 1024 ** 3, freeDiskBytes: 8 * 1024 ** 3,
      acceleration: "cpu", unavailableFields: [] }), { async withUnboundInstallation(_id, operation) { return operation(); } });
    await lifecycle.load(job.installationId, { contextTokens: 128, maximumOutputTokens: 128, threads: 2 }, new AbortController().signal);
    await lifecycle.unload(job.installationId);
    expect(unloaded).toBe(1);
    expect(catalog.listVisible(fixture.registry.listInstallations())).toHaveLength(1);
    await lifecycle.remove(job.installationId, 1);
    expect(catalog.listVisible(fixture.registry.listInstallations())).toEqual([]);
    expect(guarded.create(input).id).toBe(job.id);
    expect(() => guarded.create({ ...input, requestId: randomUUID() })).toThrow("model_retired");
  } finally { await fixture.close(); }
});

test("retired imports do not consume native grants, create jobs or copy files", async () => {
  const fixture = await modelFixture("preserved-model");
  try {
    const selections = new NativeModelSelections();
    const source = join(fixture.directory, "chosen.gguf"); await writeFile(source, "preserved-model");
    const selectionId = await selections.grant("synthetic-window", source);
    const catalog = new CuratedCatalog([{ ...fixture.manifest, availability: "retired" }]);
    const imports = new ModelImports(catalog, fixture.registry, fixture.artifacts, selections);
    await expect(imports.import("synthetic-window", { requestId: randomUUID(), selectionId,
      catalogId: fixture.manifest.id, revision: fixture.manifest.revision }, new AbortController().signal)).rejects.toThrow("model_retired");
    expect(fixture.registry.listJobs()).toEqual([]);
    const stillGranted = await selections.consume("synthetic-window", selectionId); await stillGranted.close();
    expect(await readFile(source, "utf8")).toBe("preserved-model");
  } finally { await fixture.close(); }
});

test("personal catalog is empty for a fresh profile and direct acquisition returns localized retirement errors", async () => {
  const fixture = await modelFixture();
  const composition = composeLocalModels({ directory: fixture.directory, database: fixture.database, bindings: async () => [] });
  try {
    const api = localModelRoutes(composition.service, { async resolve() {
      return { userId: "synthetic-user", workspaceId: "synthetic-workspace", locale: "pt-BR" };
    } }, "/api/v1").compile();
    const catalogResponse = await api.handle(new Request("http://localhost/api/v1/local-models/catalog"));
    expect(catalogResponse.status).toBe(200);
    expect(await catalogResponse.json()).toEqual({ models: [] });
    const model = composition.service.catalog.list()[0]!;
    const messages = new Set<string>();
    for (const locale of ["pt-BR", "en", "es"]) {
      const response = await api.handle(new Request("http://localhost/api/v1/local-models/downloads", {
        method: "POST", headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ requestId: randomUUID(), catalogId: model.id, revision: model.revision }),
      }));
      expect(response.status).toBe(409);
      const body = await response.json(); expect(body.error.code).toBe("model_retired");
      messages.add(body.error.message);
      const mapped = await errorResponse(new LocalModelError("model_retired", 409),
        new Request("http://localhost", { headers: { "accept-language": locale } }), "synthetic").json();
      expect(mapped.error.message).toBe(body.error.message);
    }
    expect(messages.size).toBe(3);
    expect(fixture.registry.listJobs()).toEqual([]);
  } finally { await composition.close(); await fixture.close(); }
});
