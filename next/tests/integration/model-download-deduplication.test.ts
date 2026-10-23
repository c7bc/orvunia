import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { SqliteModelRegistry } from "../../packages/local-models/registry.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

test("different request IDs share one active/installed catalog job with durable aliases", async () => {
  const fixture = await modelFixture();
  try {
    const catalog = new CuratedCatalog([fixture.manifest, { ...fixture.manifest, id: "another-model" }]);
    const downloads = new ModelDownloads(catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const firstId = randomUUID(); const secondId = randomUUID();
    const input = { requestId: firstId, catalogId: "synthetic", revision: fixture.manifest.revision };
    const first = downloads.create(input); const second = downloads.create({ ...input, requestId: secondId });
    expect(second.id).toBe(first.id); expect(fixture.registry.listJobs()).toHaveLength(1);
    await downloads.run(first.id);
    const third = downloads.create({ ...input, requestId: randomUUID() });
    expect(third.id).toBe(first.id); expect(third.state).toBe("installed");
    const restarted = new ModelDownloads(catalog, new SqliteModelRegistry(fixture.database), fixture.artifacts,
      syntheticTransport("synthetic-model-integrity-fixture"));
    expect(restarted.create({ ...input, requestId: secondId }).id).toBe(first.id);
    expect(() => restarted.create({ ...input, requestId: secondId, catalogId: "another-model" })).toThrow("request_conflict");
    expect(fixture.registry.listInstallations()).toHaveLength(1);
  } finally { await fixture.close(); }
});
test("a deleted installation permits a fresh download while the original request remains a historical replay", async () => {
  const fixture = await modelFixture();
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const input = { requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision };
    const original = downloads.create(input); await downloads.run(original.id);
    const removal = fixture.registry.beginRemoval({ requestId: randomUUID(), installationId: original.installationId,
      expectedRevision: 1, lease: "lease", now: 1 });
    for (const hash of fixture.registry.removableArtifacts(original.installationId)) await fixture.artifacts.remove(hash);
    fixture.registry.finishRemoval(removal.requestId, removal.lease, true, 2);
    expect(downloads.create(input).id).toBe(original.id);
    const replacement = downloads.create({ ...input, requestId: randomUUID() });
    expect(replacement.id).not.toBe(original.id);
    expect((await downloads.run(replacement.id)).state).toBe("installed");
  } finally { await fixture.close(); }
});
