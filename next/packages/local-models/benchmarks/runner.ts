import { createHash, randomUUID } from "node:crypto";
import { LocalModelError } from "../domain.ts";
import type { ModelLifecycle } from "../lifecycle.ts";
import type { BenchmarkJob, BenchmarkResult } from "./types.ts";
import { benchmarkFixtures, type BenchmarkFixture } from "./fixtures.ts";
import { benchmarkQuality } from "./quality.ts";
import { unavailableTelemetry, type RuntimeMeasurement } from "../telemetry.ts";
import { summarizeMeasurements } from "./metrics.ts";

export type BenchmarkEngine = Pick<ModelLifecycle, "generate" | "transcribe" | "retain" | "status" | "cancel">
  & Partial<Pick<ModelLifecycle, "measureGeneration" | "measureTranscription">>;
export function emptyBenchmarkResult(): BenchmarkResult {
  return { warmupMilliseconds: null, cases: [], timeToFirstTokenMilliseconds: null,
    tokensPerSecond: null, residentMemoryBytes: null, vramBytes: null,
    unavailableReasons: ["benchmark:measurements-not-completed"] };
}
async function invoke(engine: BenchmarkEngine, job: BenchmarkJob, fixture: BenchmarkFixture, signal: AbortSignal): Promise<RuntimeMeasurement> {
  signal.throwIfAborted();
  if (createHash("sha256").update(fixture.bytes).digest("hex") !== fixture.sha256)
    throw new LocalModelError("benchmark_fixture_integrity", 500);
  const operationId = randomUUID();
  const cancel = () => engine.cancel(operationId);
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (fixture.capability === "transcription") {
      if (engine.measureTranscription) return await engine.measureTranscription(job.installationId, operationId, fixture.bytes, fixture.language!, signal);
      return { output: await engine.transcribe(job.installationId, operationId, fixture.bytes, fixture.language!, signal),
        telemetry: unavailableTelemetry("runtime-measurement-unsupported") };
    }
    const input = {
      instructions: "Complete the task. Return only the requested JSON, without markdown.", prompt: fixture.prompt,
      images: fixture.capability === "vision" ? [{ mime: "image/png" as const, data: fixture.bytes }] : [],
    };
    if (engine.measureGeneration) return await engine.measureGeneration(job.installationId, operationId, input, signal);
    return { output: await engine.generate(job.installationId, operationId, input, signal),
      telemetry: unavailableTelemetry("runtime-measurement-unsupported") };
  } finally { signal.removeEventListener("abort", cancel); }
}
export async function runBenchmark(engine: BenchmarkEngine, job: BenchmarkJob, signal: AbortSignal,
  progress: (result: BenchmarkResult) => void): Promise<BenchmarkResult> {
  const fixtures = benchmarkFixtures(job.snapshot.manifest.capabilities);
  const first = fixtures[0];
  if (!first) throw new LocalModelError("benchmark_capability_unavailable", 409);
  const result = emptyBenchmarkResult();
  const warmupStarted = performance.now();
  await invoke(engine, job, first, signal);
  signal.throwIfAborted();
  result.warmupMilliseconds = performance.now() - warmupStarted;
  progress(structuredClone(result));
  for (const fixture of fixtures) {
    const started = performance.now();
    const measured = await invoke(engine, job, fixture, signal);
    const output = measured.output;
    signal.throwIfAborted();
    result.cases.push({ capability: fixture.capability, language: fixture.language, fixtureId: fixture.id,
      fixtureSha256: fixture.sha256, latencyMilliseconds: measured.latencyMilliseconds ?? performance.now() - started,
      output: output.slice(0, 16_000), outputTruncated: output.length > 16_000, reference: fixture.reference,
      quality: benchmarkQuality(fixture.capability, fixture.reference, output), telemetry: measured.telemetry });
    summarizeMeasurements(result);
    progress(structuredClone(result));
  }
  return result;
}
