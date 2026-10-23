import { expect, test } from "bun:test";
import { link, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { ModelLifecycle } from "../../packages/local-models/lifecycle.ts";
import { NativeModelSelections } from "../../packages/local-models/selections.ts";
import { ModelImports } from "../../packages/local-models/imports.ts";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

test("shared blobs remain until last installation removal; blocked bindings keep data", async () => {
  const fixture = await modelFixture();
  try {
    const catalog = new CuratedCatalog([fixture.manifest, { ...fixture.manifest, id: "alternative-catalog-entry" }]);
    const downloads = new ModelDownloads(catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const first = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    const second = downloads.create({ requestId: randomUUID(), catalogId: "alternative-catalog-entry", revision: fixture.manifest.revision });
    await downloads.run(first.id); await downloads.run(second.id);
    expect(fixture.registry.artifactReferences(fixture.manifest.files[0]!.sha256)).toBe(2);
    let bound = true;
    const lifecycle = new ModelLifecycle(fixture.catalog, fixture.registry, fixture.artifacts, [], async () => { throw Error("unused"); }, {
      async withUnboundInstallation(_id, operation) { if (bound) throw Error("installation_bound"); return operation(); },
    });
    await expect(lifecycle.remove(first.installationId, 1)).rejects.toThrow("installation_bound");
    bound = false;
    await lifecycle.remove(first.installationId, 1);
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(true);
    await lifecycle.remove(second.installationId, 1);
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(false);
    expect(fixture.registry.artifactReferences(fixture.manifest.files[0]!.sha256)).toBe(0);
  } finally { await fixture.close(); }
});
test("deletion CAS rejects stale writers without touching artifacts", async () => {
  const fixture = await modelFixture();
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    await downloads.run(job.id);
    expect(() => fixture.registry.markDeleting(job.installationId, 99)).toThrow("installation_conflict");
    expect(fixture.registry.findInstallation(job.installationId)?.state).toBe("installed");
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(true);
  } finally { await fixture.close(); }
});
test("hardlinked blobs and path traversal cannot be removed through the artifact store", async () => {
  const fixture = await modelFixture("valid");
  try {
    const source = join(fixture.directory, "important.txt");
    await writeFile(source, "do-not-delete");
    await fixture.artifacts.initialize();
    await link(source, join(fixture.directory, "artifacts", `${fixture.manifest.files[0]!.sha256}.blob`));
    await expect(fixture.artifacts.remove(fixture.manifest.files[0]!.sha256)).rejects.toThrow("unsafe_artifact_path");
    await expect(fixture.artifacts.remove("../important.txt")).rejects.toThrow("unsafe_artifact_path");
    expect(await readFile(source, "utf8")).toBe("do-not-delete");
  } finally { await fixture.close(); }
});
test("native selections bind actor, expire on use, and import only the curated exact hash", async () => {
  const fixture = await modelFixture("valid");
  try {
    const source = join(fixture.directory, "chosen.gguf"); await writeFile(source, "valid");
    const selections = new NativeModelSelections();
    const selectionId = await selections.grant("window:1", source);
    await expect(selections.consume("window:2", selectionId)).rejects.toThrow("selection_expired");
    const importer = new ModelImports(fixture.catalog, fixture.registry, fixture.artifacts, selections);
    const input = { requestId: randomUUID(), selectionId, catalogId: "synthetic", revision: fixture.manifest.revision };
    const installed = await importer.import("window:1", input, new AbortController().signal);
    expect(installed.state).toBe("installed");
    expect((await importer.import("window:1", input, new AbortController().signal)).id).toBe(installed.id);
    await expect(selections.consume("window:1", selectionId)).rejects.toThrow("selection_expired");
    expect(await readFile(source, "utf8")).toBe("valid");
  } finally { await fixture.close(); }
});
test("interrupted jobs recover explicitly and conditional revisions fence concurrent writers", async () => {
  const fixture = await modelFixture();
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
    const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    expect(fixture.registry.replaceJob({ ...job, progressRevision: 2, state: "downloading" }, 1)).toBe(true);
    expect(fixture.registry.replaceJob({ ...job, progressRevision: 2, state: "cancelled" }, 1)).toBe(false);
    expect(downloads.recoverInterrupted()).toBe(1);
    expect(fixture.registry.findJob(job.id)?.errorCode).toBe("download_interrupted");
    expect((await downloads.run(job.id)).state).toBe("installed");
  } finally { await fixture.close(); }
});
