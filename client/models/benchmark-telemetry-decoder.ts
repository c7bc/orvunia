import { object, list, string } from "../connections/domain.js";
import type { BenchmarkTelemetry, BenchmarkMeasurementCounts, BenchmarkAggregation } from "./benchmark-domain.js";

export function measurementNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw Error("Resposta inválida do servidor.");
  return value;
}
export const nullableMeasurement = (value: unknown) => value === null ? null : measurementNumber(value);
function count(value: unknown) {
  const result = measurementNumber(value);
  if (!Number.isSafeInteger(result)) throw Error("Resposta inválida do servidor.");
  return result;
}
const provenance = (value: unknown) => value === null ? null : string(value);
export function benchmarkTelemetry(value: unknown, transcription: boolean): BenchmarkTelemetry {
  const item = object(value), origin = object(item.provenance);
  const telemetry = { timeToFirstTokenMilliseconds: nullableMeasurement(item.timeToFirstTokenMilliseconds),
    tokensPerSecond: nullableMeasurement(item.tokensPerSecond), residentMemoryBytes: nullableMeasurement(item.residentMemoryBytes),
    vramBytes: nullableMeasurement(item.vramBytes), generatedTokens: item.generatedTokens === null ? null : count(item.generatedTokens),
    generationMilliseconds: nullableMeasurement(item.generationMilliseconds), memorySamples: count(item.memorySamples),
    provenance: { timeToFirstToken: provenance(origin.timeToFirstToken), tokensPerSecond: provenance(origin.tokensPerSecond),
      residentMemory: provenance(origin.residentMemory), vram: provenance(origin.vram) },
    unavailableReasons: list(item.unavailableReasons).map(string) };
  if (transcription && (telemetry.timeToFirstTokenMilliseconds !== null || telemetry.tokensPerSecond !== null ||
    telemetry.generatedTokens !== null || telemetry.generationMilliseconds !== null)) throw Error("Resposta inválida do servidor.");
  return telemetry;
}
export function benchmarkMeasurementCounts(value: unknown): BenchmarkMeasurementCounts {
  const item = object(value);
  return { timeToFirstToken: count(item.timeToFirstToken), tokensPerSecond: count(item.tokensPerSecond),
    residentMemory: count(item.residentMemory), vram: count(item.vram) };
}
export function benchmarkAggregation(value: unknown): BenchmarkAggregation {
  const item = object(value);
  if (item.timeToFirstToken !== "mean-measured-cases" || item.tokensPerSecond !== "sum-tokens-over-sum-generation-time" ||
    item.residentMemory !== "max-sampled-owned-process" || item.vram !== "max-measured-cases") throw Error("Resposta inválida do servidor.");
  return { timeToFirstToken: item.timeToFirstToken, tokensPerSecond: item.tokensPerSecond,
    residentMemory: item.residentMemory, vram: item.vram };
}
