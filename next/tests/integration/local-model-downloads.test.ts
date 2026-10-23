import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { publicModelJob } from "../../packages/local-models/contracts.ts";
import { modelFixture, syntheticTransport } from "../support/local-models.ts";

test("verified synthetic acquisition installs durably and replays without another request", async () => {
  const fixture = await modelFixture();
  try {
    let calls = 0;
    const upstream = syntheticTransport("synthetic-model-integrity-fixture");
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, {
      async open(...argumentsList) { calls++; return upstream.open(...argumentsList); },
    });
    const input = { requestId: fixture.requestId, catalogId: fixture.manifest.id, revision: fixture.manifest.revision };
    const job = downloads.create(input);
    expect(downloads.create(input).id).toBe(job.id);
    const result = await downloads.run(job.id);
    expect(result.state).toBe("installed"); expect(calls).toBe(1);
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(true);
    expect(fixture.registry.findInstallation(job.installationId)?.state).toBe("installed");
    expect((await downloads.run(job.id)).state).toBe("installed"); expect(calls).toBe(1);
    expect(publicModelJob(result)).not.toHaveProperty("etags");
    expect(publicModelJob(result)).not.toHaveProperty("fingerprint");
  } finally { await fixture.close(); }
});
test("hash mismatch does not publish an installation or a valid blob", async () => {
  const fixture = await modelFixture("valid");
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("wrong"));
    const job = downloads.create({ requestId: fixture.requestId, catalogId: "synthetic", revision: fixture.manifest.revision });
    const result = await downloads.run(job.id);
    expect(result.state).toBe("failed"); expect(result.errorCode).toBe("artifact_hash_mismatch");
    expect(fixture.registry.listInstallations()).toEqual([]);
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(false);
  } finally { await fixture.close(); }
});
test("cancel keeps partial bytes; resume verifies ETag and Range before appending", async () => {
  const fixture = await modelFixture("abcdef");
  try {
    const job = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("abcdef"))
      .create({ requestId: fixture.requestId, catalogId: "synthetic", revision: fixture.manifest.revision });
    await fixture.artifacts.write(job.id, fixture.manifest.files[0]!, Buffer.from("abc"), 0);
    const cancelled = { ...job, state: "cancelled" as const, progressRevision: 2, etags: { weights: '"fixed"' } };
    expect(fixture.registry.replaceJob(cancelled, 1)).toBe(true);
    let receivedOffset = 0;
    const upstream = syntheticTransport("abcdef");
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, {
      async open(file, offset, etag, signal) { receivedOffset = offset; return upstream.open(file, offset, etag, signal); },
    });
    expect((await downloads.run(job.id)).state).toBe("installed");
    expect(receivedOffset).toBe(3);
  } finally { await fixture.close(); }
});
test("changed ETag restarts the private part instead of combining revisions", async () => {
  const fixture = await modelFixture("abcdef");
  try {
    const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, syntheticTransport("abcdef"));
    const job = downloads.create({ requestId: randomUUID(), catalogId: "synthetic", revision: fixture.manifest.revision });
    await fixture.artifacts.write(job.id, fixture.manifest.files[0]!, Buffer.from("xxx"), 0);
    fixture.registry.replaceJob({ ...job, state: "cancelled", progressRevision: 2, etags: { weights: '"old"' } }, 1);
    expect((await downloads.run(job.id)).state).toBe("installed");
  } finally { await fixture.close(); }
});
