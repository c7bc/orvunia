export type RuntimeTelemetry = {
  timeToFirstTokenMilliseconds: number | null;
  tokensPerSecond: number | null;
  generatedTokens: number | null;
  generationMilliseconds: number | null;
  residentMemoryBytes: number | null;
  vramBytes: number | null;
  memorySamples: number;
  provenance: {
    timeToFirstToken: string | null;
    tokensPerSecond: string | null;
    residentMemory: string | null;
    vram: string | null;
  };
  unavailableReasons: string[];
};
export type RuntimeMeasurement = { output: string; telemetry: RuntimeTelemetry; latencyMilliseconds?: number };
export function unavailableTelemetry(reason: string): RuntimeTelemetry {
  return { timeToFirstTokenMilliseconds: null, tokensPerSecond: null, generatedTokens: null,
    generationMilliseconds: null, residentMemoryBytes: null, vramBytes: null, memorySamples: 0,
    provenance: { timeToFirstToken: null, tokensPerSecond: null, residentMemory: null, vram: null },
    unavailableReasons: [reason] };
}
