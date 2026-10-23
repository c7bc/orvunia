import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { ModelBenchmarks } from "../../packages/local-models/benchmarks/service.ts";
import { SqliteBenchmarks } from "../../packages/local-models/benchmarks/store.ts";
import { benchmarkFixture, deferred, until } from "../support/benchmarks.ts";

test("consent and loaded handle are required, without loading, network or inference", async () => {
  const fixture = await benchmarkFixture(); const benchmarks = fixture.service();
  try {
    expect(() => benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: false })).toThrow("benchmark_consent_required");
    expect(() => benchmarks.create("owner", fixture.installationId, { requestId: "invalid", consent: true })).toThrow("invalid_input");
    expect(() => benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true })).toThrow("benchmark_not_loaded");
    expect(benchmarks.list("owner", fixture.installationId)).toEqual([]);
    expect(fixture.lifecycle.status()).toEqual([]); expect(fixture.calls).toHaveLength(0);
    expect(fixture.registry.listInstallations()).toHaveLength(1);
  } finally { await benchmarks.close(); await fixture.close(); }
});

test("one profile job, stable retries, immutable snapshots and measured results survive database reopening", async () => {
  const fixture = await benchmarkFixture(["text", "vision", "transcription"]);
  await fixture.load(); const benchmarks = fixture.service();
  const gate = deferred(); fixture.hook(async () => gate.promise);
  try {
    const input = { requestId: randomUUID(), consent: true };
    const job = benchmarks.create("owner", fixture.installationId, input);
    expect(benchmarks.create("owner", fixture.installationId, input)).toEqual(job);
    const admissions = Array.from({ length: 4 }, () => {
      try { benchmarks.create("owner", fixture.installationId, { ...input, requestId: randomUUID() }); return "accepted"; }
      catch (error) { return (error as Error).message; }
    });
    expect(admissions).toEqual(Array(4).fill("benchmark_busy"));
    expect(() => benchmarks.create("owner", randomUUID(), input)).toThrow("request_conflict");
    expect(() => benchmarks.create("foreign", fixture.installationId, input)).toThrow("benchmark_busy");
    await expect(fixture.lifecycle.unload(fixture.installationId)).rejects.toThrow("runtime_in_use");
    gate.resolve(); await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "completed");
    const completed = benchmarks.list("owner", fixture.installationId)[0]!;
    expect(completed.result?.cases).toHaveLength(5); expect(fixture.calls).toHaveLength(6);
    expect(completed.result?.cases.every(entry => entry.quality.passed && entry.latencyMilliseconds >= 0)).toBe(true);
    expect(completed.result?.cases.filter(entry => entry.capability === "transcription").map(entry => entry.language)).toEqual(["pt", "en", "es"]);
    expect(completed.result?.warmupMilliseconds).toBeNumber();
    expect(completed.result).toMatchObject({ timeToFirstTokenMilliseconds: null, tokensPerSecond: null, residentMemoryBytes: null, vramBytes: null });
    expect(completed.snapshot.runtime).toEqual({ kind: "llama.cpp", version: "controlled-runtime", sha256: "b".repeat(64) });
    expect(completed.snapshot.runtime).not.toHaveProperty("path");
    expect(completed.snapshot.manifest).toMatchObject({ evaluation: "not-verified", memory: { calibrated: false } });
    expect(benchmarks.list("foreign", fixture.installationId)).toEqual([]);
    expect(benchmarks.create("owner", fixture.installationId, input)).toEqual(completed);
    const reconnected = new Database(join(fixture.directory, "models.sqlite"));
    try {
      const store = new SqliteBenchmarks(reconnected);
      const reopened = new ModelBenchmarks({ store, registry: fixture.registry, catalog: fixture.catalog,
        engine: fixture.lifecycle, runtimes: {} });
      expect(reopened.create("owner", fixture.installationId, input)).toEqual(completed);
      expect(fixture.calls).toHaveLength(6); await reopened.close();
    } finally { reconnected.close(); }
    await fixture.lifecycle.unload(fixture.installationId);
    expect(fixture.unloads()).toBe(1);
  } finally { gate.resolve(); await benchmarks.close(); await fixture.close(); }
});

test("startup interrupts queued/running/cancelling durably without rerunning inference or changing completed receipts", async () => {
  const fixture = await benchmarkFixture(); await fixture.load();
  let benchmarks = fixture.service();
  try {
    const first = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "completed");
    const completed = benchmarks.list("owner", fixture.installationId)[0]!;
    await benchmarks.close(); const previousCalls = fixture.calls.length;
    for (const state of ["queued", "running", "cancelling"] as const) {
      const interrupted = { ...first, id: randomUUID(), requestId: randomUUID(), state };
      fixture.store.create("owner", interrupted);
      benchmarks = fixture.service();
      expect(fixture.store.find("owner", interrupted.id)).toMatchObject({ state: "failed", error: { code: "benchmark_interrupted" }, revision: 2 });
      expect(benchmarks.create("owner", fixture.installationId, { requestId: interrupted.requestId, consent: true }).state).toBe("failed");
      await benchmarks.close();
    }
    expect(fixture.store.find("owner", completed.id)).toEqual(completed);
    expect(fixture.calls).toHaveLength(previousCalls);
  } finally { await benchmarks.close(); await fixture.close(); }
});
