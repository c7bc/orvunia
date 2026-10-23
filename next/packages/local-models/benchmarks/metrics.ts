import type { BenchmarkResult } from "./types.ts";

export function summarizeMeasurements(result: BenchmarkResult): void {
  const measurements = result.cases.flatMap(entry => entry.telemetry ? [entry.telemetry] : []);
  const firstTokens = measurements.flatMap(value => value.timeToFirstTokenMilliseconds === null ? [] : [value.timeToFirstTokenMilliseconds]);
  const speeds = measurements.filter(value => value.tokensPerSecond !== null && value.generatedTokens !== null && value.generationMilliseconds !== null);
  const memory = measurements.flatMap(value => value.residentMemoryBytes === null ? [] : [value.residentMemoryBytes]);
  const video = measurements.flatMap(value => value.vramBytes === null ? [] : [value.vramBytes]);
  result.timeToFirstTokenMilliseconds = firstTokens.length ? firstTokens.reduce((sum, value) => sum + value / firstTokens.length, 0) : null;
  const tokens = speeds.reduce((sum, value) => sum + value.generatedTokens!, 0);
  const duration = speeds.reduce((sum, value) => sum + value.generationMilliseconds!, 0);
  const rate = tokens * 1000 / duration;
  result.tokensPerSecond = speeds.length && Number.isFinite(rate) && rate > 0 ? rate : null;
  result.residentMemoryBytes = memory.length ? Math.max(...memory) : null;
  result.vramBytes = video.length ? Math.max(...video) : null;
  result.measurementCounts = { timeToFirstToken: firstTokens.length, tokensPerSecond: speeds.length,
    residentMemory: memory.length, vram: video.length };
  result.aggregation = { timeToFirstToken: "mean-measured-cases", tokensPerSecond: "sum-tokens-over-sum-generation-time",
    residentMemory: "max-sampled-owned-process", vram: "max-measured-cases" };
  result.unavailableReasons = [...new Set(measurements.flatMap(value => value.unavailableReasons))];
  if (!measurements.length) result.unavailableReasons.push("benchmark:measurements-not-completed");
}
