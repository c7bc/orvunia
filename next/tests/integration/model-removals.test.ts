import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { ModelLifecycle } from "../../packages/local-models/lifecycle.ts";
import { NativeModelSelections } from "../../packages/local-models/selections.ts";
import type { ArtifactStore } from "../../packages/local-models/ports.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

async function installedFixture() {
  const fixture = await modelFixture();
  const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("synthetic-model-integrity-fixture"));
  const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
  await downloads.run(job.id);
  return { ...fixture, job };
}
test("removal request replays across calls and restarts; changed payload or owner conflicts", async () => {
  const fixture = await installedFixture();
  try {
    const lifecycle = () => new ModelLifecycle(fixture.catalog, fixture.registry, fixture.artifacts, [],
      async () => { throw Error("Removal does not probe hardware"); }, { async withUnboundInstallation(_id, operation) { return operation(); } });
    const service = lifecycle(); const requestId = randomUUID();
    await Promise.all([service.remove(fixture.job.installationId, 1, requestId), service.remove(fixture.job.installationId, 1, requestId)]);
    await lifecycle().remove(fixture.job.installationId, 1, requestId);
    expect(fixture.registry.findInstallation(fixture.job.installationId)?.state).toBe("deleted");
    await expect(service.remove(fixture.job.installationId, 2, requestId)).rejects.toThrow("request_conflict");
    await expect(service.remove(fixture.job.installationId, 1, randomUUID())).rejects.toThrow("request_conflict");
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(false);
  } finally { await fixture.close(); }
});
test("expired removal leases can be recovered and cannot finalize with a stale token", async () => {
  const fixture = await installedFixture();
  try {
    const requestId = randomUUID(); const lease = randomUUID();
    fixture.registry.beginRemoval({ requestId, installationId: fixture.job.installationId, expectedRevision: 1, lease, now: 1000 });
    expect(() => fixture.registry.beginRemoval({ requestId, installationId: fixture.job.installationId, expectedRevision: 1,
      lease: "another", now: 2000 })).toThrow("installation_busy");
    expect(() => fixture.registry.finishRemoval(requestId, lease, true, 31_000)).toThrow("removal_lease_expired");
    const recovered = fixture.registry.beginRemoval({ requestId, installationId: fixture.job.installationId,
      expectedRevision: 1, lease: "recovery-token", now: 31_001 });
    expect(() => fixture.registry.finishRemoval(requestId, lease, true, 31_002)).toThrow("removal_lease_expired");
    for (const hash of fixture.registry.removableArtifacts(fixture.job.installationId)) await fixture.artifacts.remove(hash);
    fixture.registry.finishRemoval(requestId, recovered.lease, true, 31_002);
    expect(fixture.registry.findInstallation(fixture.job.installationId)?.state).toBe("deleted");
  } finally { await fixture.close(); }
});
test("expired native picker token never grants file access", async () => {
  const fixture = await modelFixture();
  try {
    let now = 0; const picker = new NativeModelSelections(() => now);
    const file = join(fixture.directory, "selected.gguf"); await writeFile(file, "synthetic");
    const token = await picker.grant("owner", file); now = 300_000;
    await expect(picker.consume("owner", token)).rejects.toThrow("selection_expired");
  } finally { await fixture.close(); }
});
test("cancellation racing a transfer preserves partial bytes and cannot publish an installation", async () => {
  const fixture = await modelFixture("abcdef");
  try {
    let opened: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { opened = resolve; });
    const artifacts: ArtifactStore = {
      partial: fixture.artifacts.partial.bind(fixture.artifacts), reset: fixture.artifacts.reset.bind(fixture.artifacts),
      has: fixture.artifacts.has.bind(fixture.artifacts), remove: fixture.artifacts.remove.bind(fixture.artifacts),
      path: fixture.artifacts.path.bind(fixture.artifacts), verifyAndCommit: fixture.artifacts.verifyAndCommit.bind(fixture.artifacts),
      async write(...parameters) { await fixture.artifacts.write(...parameters); opened(); },
    };
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, artifacts, {
      async open(_file, _offset, _etag, signal) {
        return { status: 200, etag: '"fixed"', contentRange: null, body: new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from("abc"));
            signal.addEventListener("abort", () => controller.error(new DOMException("Cancelled", "AbortError")), { once: true });
          },
        }) };
      },
    });
    const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    const running = downloads.run(job.id); await ready; downloads.cancel(job.id);
    expect((await running).state).toBe("cancelled");
    expect(fixture.registry.findInstallation(job.installationId)).toBeNull();
    expect((await fixture.artifacts.partial(job.id, fixture.manifest.files[0]!)).bytes).toBe(3);
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(false);
  } finally { await fixture.close(); }
});
