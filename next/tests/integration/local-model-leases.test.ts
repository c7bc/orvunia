import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { ModelLifecycle } from "../../packages/local-models/lifecycle.ts";
import type { RuntimeAdapter, RuntimeHandle } from "../../packages/local-models/runtime.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

test("retained handles block unload/removal until release, and release is idempotent", async () => {
  const fixture = await modelFixture();
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    await downloads.run(job.id);
    let unloads = 0;
    const handle: RuntimeHandle = { id: randomUUID(), installationId: job.installationId, runtime: "llama.cpp", capabilities: ["text"] };
    const adapter: RuntimeAdapter = { kind: "llama.cpp", async load() { return handle; },
      async generate() { throw Error("Lease test does not infer"); }, async transcribe() { throw Error("Lease test does not infer"); },
      cancel() {}, async unload() { unloads++; }, async health() { return true; } };
    const lifecycle = new ModelLifecycle(fixture.catalog, fixture.registry, fixture.artifacts, [adapter], async () => ({
      measuredAt: new Date().toISOString(), architecture: "x64", processors: 4, totalMemoryBytes: 8 * 1024 ** 3,
      availableMemoryBytes: 6 * 1024 ** 3, freeDiskBytes: 10 * 1024 ** 3, acceleration: "cpu", unavailableFields: [],
    }), { async withUnboundInstallation(_id, operation) { return operation(); } });
    await lifecycle.load(job.installationId, { contextTokens: 128, maximumOutputTokens: 64, threads: 2 }, new AbortController().signal);
    const release = lifecycle.retain(job.installationId);
    await expect(lifecycle.unload(job.installationId)).rejects.toThrow("runtime_in_use");
    await expect(lifecycle.remove(job.installationId, 1)).rejects.toThrow("runtime_in_use");
    expect(fixture.registry.findInstallation(job.installationId)?.state).toBe("installed");
    release(); release();
    expect(lifecycle.status()[0]?.inUse).toBe(false);
    await lifecycle.remove(job.installationId, 1);
    expect(unloads).toBe(1); expect(lifecycle.status()).toEqual([]);
  } finally { await fixture.close(); }
});
