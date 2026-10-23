import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { ModelBenchmarks } from "../../packages/local-models/benchmarks/service.ts";
import { benchmarkFixture, deferred, until } from "../support/benchmarks.ts";

test("worker persistence failure is observed, drains/releases, refuses new work and recovers uncertain receipt at restart", async () => {
  const fixture = await benchmarkFixture(); await fixture.load();
  const store = fixture.store;
  const failing = new ModelBenchmarks({ store: {
    find: (...args) => store.find(...args), findRequest: (...args) => store.findRequest(...args),
    list: (...args) => store.list(...args), create: (...args) => store.create(...args), interrupt: now => store.interrupt(now),
    replace() { throw Error("controlled unavailable storage"); },
  }, registry: fixture.registry, catalog: fixture.catalog, engine: fixture.lifecycle,
  runtimes: { llama: { path: "not-executed", version: "controlled", sha256: "b".repeat(64) } } });
  try {
    const job = failing.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => fixture.lifecycle.status()[0]?.inUse === false);
    await Bun.sleep(1);
    expect(fixture.calls).toHaveLength(0);
    expect(store.find("owner", job.id)?.state).toBe("queued");
    expect(() => failing.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true })).toThrow("benchmark_persistence_failed");
    await expect(failing.close()).rejects.toThrow("benchmark_persistence_failed");
    const recovered = fixture.service();
    expect(recovered.list("owner", fixture.installationId)[0]).toMatchObject({ state: "failed", error: { code: "benchmark_interrupted" } });
    expect(fixture.calls).toHaveLength(0); await recovered.close();
  } finally { await fixture.close(); }
});

test("durable uniqueness, compare-and-swap and bounded history preserve older receipts", async () => {
  const fixture = await benchmarkFixture(); await fixture.load(); const benchmarks = fixture.service();
  try {
    const job = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    expect(() => fixture.store.create("foreign", { ...job, id: randomUUID() })).toThrow("request_conflict");
    expect(() => fixture.store.create("foreign", { ...job, id: randomUUID(), requestId: randomUUID() })).toThrow("benchmark_busy");
    await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "completed");
    const completed = fixture.store.find("owner", job.id)!;
    expect(() => fixture.store.replace({ ...completed, revision: completed.revision + 10 })).toThrow("benchmark_conflict");
    for (let index = 0; index < 21; index++) fixture.store.create("owner", { ...completed,
      id: randomUUID(), requestId: randomUUID(), createdAt: completed.createdAt + index + 1 });
    expect(benchmarks.list("owner", fixture.installationId)).toHaveLength(20);
    expect(fixture.store.find("owner", completed.id)).toEqual(completed);
    expect(fixture.calls).toHaveLength(2);
  } finally { await benchmarks.close(); await fixture.close(); }
});

test("cancel still aborts and drains native work when persisting cancellation fails", async () => {
  const fixture = await benchmarkFixture(); await fixture.load();
  const aborted = deferred(); const drained = deferred(); let unavailable = false;
  fixture.hook(async signal => {
    signal.addEventListener("abort", () => aborted.resolve(), { once: true });
    await drained.promise; signal.throwIfAborted();
  });
  const store = fixture.store;
  const benchmarks = new ModelBenchmarks({ store: {
    find: (...args) => store.find(...args), findRequest: (...args) => store.findRequest(...args),
    list: (...args) => store.list(...args), create: (...args) => store.create(...args), interrupt: now => store.interrupt(now),
    replace(job) { if (unavailable) throw Error("controlled storage failure"); store.replace(job); },
  }, registry: fixture.registry, catalog: fixture.catalog, engine: fixture.lifecycle,
  runtimes: { llama: { path: "not-executed", version: "controlled", sha256: "b".repeat(64) } } });
  try {
    const job = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => fixture.calls.length === 1); unavailable = true;
    const cancellation = benchmarks.cancel("owner", job.id).catch(error => error);
    await aborted.promise;
    expect(fixture.lifecycle.status()[0]?.inUse).toBe(true);
    drained.resolve(); expect((await cancellation).code).toBe("benchmark_persistence_failed");
    expect(fixture.lifecycle.status()[0]?.inUse).toBe(false);
    expect(store.find("owner", job.id)?.state).toBe("running");
    await expect(benchmarks.close()).rejects.toThrow("benchmark_persistence_failed");
    unavailable = false;
    const recovered = fixture.service();
    expect(recovered.list("owner", fixture.installationId)[0]?.error?.code).toBe("benchmark_interrupted");
    await recovered.close();
  } finally { drained.resolve(); await fixture.close(); }
});
