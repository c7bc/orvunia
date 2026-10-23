import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { unavailableTelemetry } from "../../packages/local-models/telemetry.ts";
import { benchmarkFixture, until } from "../support/benchmarks.ts";
import { summarizeMeasurements } from "../../packages/local-models/benchmarks/metrics.ts";
import { emptyBenchmarkResult } from "../../packages/local-models/benchmarks/runner.ts";

test("measured cases persist provenance and exact aggregate definitions without rewriting legacy null receipts", async () => {
  const fixture = await benchmarkFixture(["text", "vision"]); await fixture.load();
  fixture.adapter.measureGeneration = async (handle, operation, input, signal) => {
    const output = await fixture.adapter.generate(handle, operation, input, signal);
    const image = input.images.length > 0;
    return { output, latencyMilliseconds: image ? 20 : 10, telemetry: {
      timeToFirstTokenMilliseconds: image ? 6 : 2, tokensPerSecond: image ? 10 : 20,
      generatedTokens: image ? 2 : 4, generationMilliseconds: 200,
      residentMemoryBytes: image ? 8192 : 4096, vramBytes: 0, memorySamples: 3,
      provenance: { timeToFirstToken: "client-monotonic-first-content", tokensPerSecond: "llama-predicted-n-over-predicted-ms",
        residentMemory: "linux-proc-vmrss", vram: "policy-cpu-disabled" }, unavailableReasons: [],
    } };
  };
  const benchmarks = fixture.service();
  try {
    const job = benchmarks.create("owner", fixture.installationId, { requestId: randomUUID(), consent: true });
    await until(() => benchmarks.list("owner", fixture.installationId)[0]?.state === "completed");
    const result = fixture.store.find("owner", job.id)!.result!;
    expect(result).toMatchObject({ timeToFirstTokenMilliseconds: 4, tokensPerSecond: 15,
      residentMemoryBytes: 8192, vramBytes: 0, measurementCounts: {
        timeToFirstToken: 2, tokensPerSecond: 2, residentMemory: 2, vram: 2 },
      aggregation: { timeToFirstToken: "mean-measured-cases", tokensPerSecond: "sum-tokens-over-sum-generation-time",
        residentMemory: "max-sampled-owned-process", vram: "max-measured-cases" } });
    expect(result.cases.map(value => value.latencyMilliseconds)).toEqual([10, 20]);
    expect(result.cases.every(value => value.telemetry?.memorySamples === 3)).toBe(true);
    const receipt = { ...fixture.store.find("owner", job.id)!, id: randomUUID(), requestId: randomUUID(), result: {
      warmupMilliseconds: 1, cases: [], timeToFirstTokenMilliseconds: null, tokensPerSecond: null,
      residentMemoryBytes: null, vramBytes: null, unavailableReasons: ["historical-unmeasured"],
    } };
    fixture.store.create("owner", receipt);
    expect(fixture.store.find("owner", receipt.id)).toEqual(receipt);
    expect(fixture.calls).toHaveLength(3);
  } finally { await benchmarks.close(); await fixture.close(); }
});

test("aggregation excludes missing metrics and preserves not-applicable reasons instead of converting missing data to zero", () => {
  const result = emptyBenchmarkResult();
  result.cases.push({ capability: "transcription", language: "pt", fixtureId: "test", fixtureSha256: "a".repeat(64),
    latencyMilliseconds: 1, output: "test", outputTruncated: false, reference: "test",
    quality: { passed: true, metric: "wer", value: 0, maximum: 0.25, criticalTermsPreserved: true },
    telemetry: unavailableTelemetry("time-to-first-token:not-applicable-transcription") });
  summarizeMeasurements(result);
  expect(result.timeToFirstTokenMilliseconds).toBeNull(); expect(result.tokensPerSecond).toBeNull();
  expect(result.residentMemoryBytes).toBeNull(); expect(result.vramBytes).toBeNull();
  expect(result.measurementCounts).toEqual({ timeToFirstToken: 0, tokensPerSecond: 0, residentMemory: 0, vram: 0 });
  expect(result.unavailableReasons).toContain("time-to-first-token:not-applicable-transcription");
});
