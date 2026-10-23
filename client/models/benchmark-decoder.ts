import { object, list, string } from "../connections/domain.js";
import type { BenchmarkCase, BenchmarkRun, BenchmarkState } from "./benchmark-domain.js";
import { benchmarkTelemetry, benchmarkMeasurementCounts, benchmarkAggregation } from "./benchmark-telemetry-decoder.js";

function number(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw Error("Resposta inválida do servidor.");
  return value;
}
const nullable = (value: unknown) => value === null ? null : number(value);
function timestamp(value: unknown) {
  const result = number(value);
  if (!Number.isSafeInteger(result) || result > 8640000000000000) throw Error("Resposta inválida do servidor.");
  return result;
}
function boolean(value: unknown) {
  if (typeof value !== "boolean") throw Error("Resposta inválida do servidor.");
  return value;
}
function hash(value: unknown) {
  const result = string(value);
  if (!/^[a-f0-9]{64}$/i.test(result)) throw Error("Resposta inválida do servidor.");
  return result;
}
function benchmarkCase(value: unknown): BenchmarkCase {
  const item = object(value), quality = object(item.quality);
  if (!["text", "vision", "transcription"].includes(String(item.capability)) ||
    (item.language !== null && !["pt", "en", "es"].includes(String(item.language))) ||
    !["exact-array", "wer"].includes(String(quality.metric))) throw Error("Resposta inválida do servidor.");
  const criticalTermsPreserved = item.capability === "transcription" ? boolean(quality.criticalTermsPreserved) : null;
  if ((item.capability !== "transcription" && quality.criticalTermsPreserved !== null) ||
    (criticalTermsPreserved === false && quality.passed === true)) throw Error("Resposta inválida do servidor.");
  return { capability: item.capability as BenchmarkCase["capability"], language: item.language as BenchmarkCase["language"],
    fixtureId: string(item.fixtureId), fixtureSha256: hash(item.fixtureSha256), latencyMilliseconds: number(item.latencyMilliseconds),
    output: string(item.output), outputTruncated: boolean(item.outputTruncated), reference: string(item.reference),
    quality: { passed: boolean(quality.passed), metric: quality.metric as BenchmarkCase["quality"]["metric"],
      value: number(quality.value), maximum: number(quality.maximum), criticalTermsPreserved },
    ...(Object.hasOwn(item, "telemetry") ? { telemetry: benchmarkTelemetry(item.telemetry, item.capability === "transcription") } : {}) };
}
export function benchmarkRun(value: unknown): BenchmarkRun {
  const item = object(value), snapshot = object(item.snapshot), manifest = object(snapshot.manifest),
    runtime = object(snapshot.runtime), settings = object(snapshot.settings);
  if (!["queued", "running", "cancelling", "completed", "failed", "cancelled"].includes(String(item.state)) ||
    !["llama.cpp", "whisper.cpp"].includes(String(runtime.kind))) throw Error("Resposta inválida do servidor.");
  const result = item.result === null ? null : object(item.result);
  return { id: string(item.id), requestId: string(item.requestId), installationId: string(item.installationId),
    state: item.state as BenchmarkState, revision: number(item.revision), createdAt: timestamp(item.createdAt),
    startedAt: item.startedAt === null ? null : timestamp(item.startedAt), finishedAt: item.finishedAt === null ? null : timestamp(item.finishedAt), snapshot: {
      manifest: { id: string(manifest.id), name: string(manifest.name), revision: string(manifest.revision), quantization: string(manifest.quantization) },
      runtime: { kind: runtime.kind as BenchmarkRun["snapshot"]["runtime"]["kind"], version: string(runtime.version), sha256: hash(runtime.sha256) },
      settings: { contextTokens: number(settings.contextTokens), maximumOutputTokens: number(settings.maximumOutputTokens), threads: number(settings.threads) },
      fixtureVersion: string(snapshot.fixtureVersion) }, result: result ? {
        warmupMilliseconds: nullable(result.warmupMilliseconds), cases: list(result.cases).map(benchmarkCase),
        timeToFirstTokenMilliseconds: nullable(result.timeToFirstTokenMilliseconds), tokensPerSecond: nullable(result.tokensPerSecond),
        residentMemoryBytes: nullable(result.residentMemoryBytes), vramBytes: nullable(result.vramBytes),
        unavailableReasons: list(result.unavailableReasons).map(string),
        ...(Object.hasOwn(result, "measurementCounts") ? { measurementCounts: benchmarkMeasurementCounts(result.measurementCounts) } : {}),
        ...(Object.hasOwn(result, "aggregation") ? { aggregation: benchmarkAggregation(result.aggregation) } : {}) } : null,
    error: item.error === null ? null : { code: string(object(item.error).code) } };
}
export function benchmarkHistory(value: unknown) {
  const runs = list(object(value).benchmarks);
  if (runs.length > 20) throw Error("Resposta inválida do servidor.");
  return runs.map(benchmarkRun);
}
