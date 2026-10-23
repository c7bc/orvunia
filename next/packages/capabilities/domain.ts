export type Capability = "text" | "vision" | "transcription";
export type ApiCapability = {
  kind: "api";
  connectionId: string;
  connectionRevision: number;
  provider: string;
  baseUrl: string;
  model: string;
  parameters: { maxTokens?: number | undefined; realtimeModel?: string | undefined; vision?: boolean | undefined };
};
export type LocalCapability = {
  kind: "local";
  installationId: string;
  catalogId: string;
  catalogRevision: string;
  runtime: "llama.cpp" | "whisper.cpp";
  settings: { contextTokens: number; maximumOutputTokens: number; threads: number };
};
export type CapabilityTarget = ApiCapability | LocalCapability | { kind: "disabled" };
export type CapabilityPlan = {
  schemaVersion: 2;
  configurationRevision: number;
  text: CapabilityTarget;
  vision: CapabilityTarget | { kind: "shared"; capability: "text" };
  transcription: CapabilityTarget;
};
export class CapabilityError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
