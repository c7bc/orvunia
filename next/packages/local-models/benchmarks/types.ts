import type { Capability, ModelManifest, RuntimeKind } from "../domain.ts";
import type { RuntimeTelemetry } from "../telemetry.ts";

export type BenchmarkState = "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
export type BenchmarkCase = {
  capability: Capability;
  language: "pt" | "en" | "es" | null;
  fixtureId: string;
  fixtureSha256: string;
  latencyMilliseconds: number;
  output: string;
  outputTruncated: boolean;
  reference: string;
  quality: { passed: boolean; metric: "exact-array" | "wer"; value: number; maximum: number; criticalTermsPreserved: boolean | null };
  telemetry?: RuntimeTelemetry;
};
export type BenchmarkResult = {
  warmupMilliseconds: number | null;
  cases: BenchmarkCase[];
  timeToFirstTokenMilliseconds: number | null;
  tokensPerSecond: number | null;
  residentMemoryBytes: number | null;
  vramBytes: number | null;
  measurementCounts?: { timeToFirstToken: number; tokensPerSecond: number; residentMemory: number; vram: number };
  aggregation?: { timeToFirstToken: "mean-measured-cases"; tokensPerSecond: "sum-tokens-over-sum-generation-time";
    residentMemory: "max-sampled-owned-process"; vram: "max-measured-cases" };
  unavailableReasons: string[];
};
export type BenchmarkJob = {
  id: string;
  requestId: string;
  installationId: string;
  state: BenchmarkState;
  revision: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  snapshot: {
    manifest: ModelManifest;
    runtime: { kind: RuntimeKind; version: string; sha256: string };
    settings: { contextTokens: number; maximumOutputTokens: number; threads: number };
    fixtureVersion: string;
  };
  result: BenchmarkResult | null;
  error: { code: string } | null;
};
export const activeBenchmarkStates: readonly BenchmarkState[] = ["queued", "running", "cancelling"];
