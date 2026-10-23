import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { benchmarkFixture, deferred, until } from "../support/benchmarks.ts";

test("queued cancel is idempotent, never invokes a runtime, and releases its retained handle", async () => {
  const fixture = await benchmarkFixture(); await fixture.load(); const benchmarks = fixture.service();
  try {
    const job = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    const foreign = benchmarks.cancel("foreign", job.id).catch(error => error);
    const cancelled = await benchmarks.cancel("owner", job.id);
    expect((await foreign).message).toBe("benchmark_not_found");
    expect(cancelled).toMatchObject({ state: "cancelled", error: { code: "benchmark_cancelled" }, result: null });
    expect(await benchmarks.cancel("owner", job.id)).toEqual(cancelled);
    expect(fixture.calls).toHaveLength(0); expect(fixture.lifecycle.status()[0]?.inUse).toBe(false);
  } finally { await benchmarks.close(); await fixture.close(); }
});

test("running cancellation and close await native drain before releasing lease or accepting work", async () => {
  const fixture = await benchmarkFixture(); await fixture.load(); const benchmarks = fixture.service();
  const aborted = deferred(); const drained = deferred();
  fixture.hook(async signal => {
    signal.addEventListener("abort", () => aborted.resolve(), { once: true });
    await drained.promise; signal.throwIfAborted();
  });
  try {
    const job = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => fixture.calls.length === 1);
    let cancelled = false;
    const pending = benchmarks.cancel("owner", job.id).then(result => { cancelled = true; return result; });
    await aborted.promise;
    expect(cancelled).toBe(false); expect(benchmarks.list("owner", fixture.installationId)[0]?.state).toBe("cancelling");
    expect(() => benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true })).toThrow("benchmark_busy");
    await expect(fixture.lifecycle.unload(fixture.installationId)).rejects.toThrow("runtime_in_use");
    await expect(fixture.lifecycle.remove(fixture.installationId, 1)).rejects.toThrow("runtime_in_use");
    let closed = false; const closing = benchmarks.close().then(() => { closed = true; });
    expect(closed).toBe(false); drained.resolve();
    expect((await pending).state).toBe("cancelled"); await closing;
    expect(closed).toBe(true); expect(fixture.calls).toHaveLength(1);
    await fixture.lifecycle.unload(fixture.installationId);
  } finally { drained.resolve(); await benchmarks.close(); await fixture.close(); }
});

test("bounded timeout aborts native work and records its own failure without retry", async () => {
  const fixture = await benchmarkFixture(); await fixture.load(); const benchmarks = fixture.service(20);
  fixture.hook(signal => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })));
  try {
    benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "failed");
    expect(benchmarks.list("owner", fixture.installationId)[0]).toMatchObject({ error: { code: "benchmark_timeout" } });
    expect(fixture.calls).toHaveLength(1); expect(fixture.lifecycle.status()[0]?.inUse).toBe(false);
  } finally { await benchmarks.close(); await fixture.close(); }
});

for (const failure of [new LocalModelError("runtime_not_loaded", 409), Error("private path must not appear")]) {
  test(`native failure persists a safe code and releases the lease: ${failure instanceof LocalModelError ? failure.code : "unknown"}`, async () => {
    const fixture = await benchmarkFixture(); await fixture.load(); const benchmarks = fixture.service();
    fixture.hook(async () => { throw failure; });
    try {
      benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
      await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "failed");
      const job = benchmarks.list("owner", fixture.installationId)[0]!;
      expect(job.error).toEqual({ code: failure instanceof LocalModelError ? failure.code : "benchmark_failed" });
      expect(JSON.stringify(job)).not.toContain("private path");
      expect(fixture.lifecycle.status()[0]?.inUse).toBe(false); expect(fixture.calls).toHaveLength(1);
    } finally { await benchmarks.close(); await fixture.close(); }
  });
}
