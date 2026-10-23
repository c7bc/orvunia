export type Capability = "text" | "vision" | "transcription";
export type Binding =
  | { kind: "api"; connectionId: string }
  | { kind: "local"; installationId: string }
  | { kind: "shared"; capability: "text" }
  | { kind: "disabled" };
export type Provider = "openai" | "anthropic" | "gemini" | "groq" |
  "openrouter" | "ollama" | "compatible" | "deepgram" | "assemblyai";
export type Parameters = { maxTokens?: number | undefined; realtimeModel?: string | undefined; vision?: boolean | undefined };
export type Connection = {
  id: string; provider: Provider; baseUrl: string; model: string;
  revision: number; capabilities: Capability[]; parameters: Parameters;
  secretRef?: string | undefined;
};
export type Secret = { kind: "saved"; value: string } |
  { kind: "environment"; provider: Provider; baseUrl: string; role: "response" | "transcription" };
export type Configuration = {
  schemaVersion: 2; revision: number; connections: Connection[];
  bindings: { text: Exclude<Binding, { kind: "shared" }>;
    vision: Binding; transcription: Exclude<Binding, { kind: "shared" }> };
  secrets: Record<string, Secret>;
};
export interface Vault {
  seal(value: string): Promise<string>;
  open(value: string): Promise<string>;
}
export interface Repository {
  transaction<Result>(action: () => Promise<Result>): Promise<Result>;
  read(): Promise<Configuration | null>;
  write(configuration: Configuration): Promise<void>;
}
export class ConnectionError extends Error {
  constructor(readonly code: "connection_revision_conflict" | "connection_invalid" |
    "connection_secret_origin_changed" | "connection_settings_unreadable" |
    "connection_busy" | "connection_not_found" | "connection_unavailable",
    readonly status = 400) { super(code); }
}
