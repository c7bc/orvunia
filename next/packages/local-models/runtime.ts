import type { Capability, ModelManifest, RuntimeKind } from "./domain.ts";
import type { RuntimeMeasurement } from "./telemetry.ts";

export type RuntimeBinary = { path: string; sha256: string; version: string };
export type RuntimeLoad = {
  installationId: string;
  manifest: ModelManifest;
  files: { role: "weights" | "projector"; path: string }[];
  contextTokens: number;
  maximumOutputTokens: number;
  threads: number;
};
export type RuntimeHandle = { id: string; installationId: string; runtime: RuntimeKind; capabilities: Capability[] };
export type RuntimeGeneration = {
  instructions: string;
  prompt: string;
  images: { mime: "image/png" | "image/jpeg"; data: Uint8Array }[];
};
export interface RuntimeAdapter {
  readonly kind: RuntimeKind;
  load(configuration: RuntimeLoad, signal: AbortSignal): Promise<RuntimeHandle>;
  generate(handleId: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<string>;
  transcribe(handleId: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<string>;
  measureGeneration?(handleId: string, operationId: string, input: RuntimeGeneration, signal: AbortSignal): Promise<RuntimeMeasurement>;
  measureTranscription?(handleId: string, operationId: string, audio: Uint8Array, language: string, signal: AbortSignal): Promise<RuntimeMeasurement>;
  cancel(operationId: string): void;
  unload(handleId: string): Promise<void>;
  health(handleId: string): Promise<boolean>;
}
