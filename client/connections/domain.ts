export type Capability = "text" | "vision" | "transcription";
export type Binding = { kind: "api"; connectionId: string } | { kind: "local"; installationId: string } |
  { kind: "shared"; capability: "text" } | { kind: "disabled" };
export type Connection = {
  id: string; revision: number; provider: string; baseUrl: string; model: string;
  capabilities: Capability[]; parameters: { maxTokens?: number; vision?: boolean; realtimeModel?: string };
  keyConfigured: boolean; keySource: string;
};
export type Configuration = {
  schemaVersion: 2; revision: number; bindings: Record<Capability, Binding>; connections: Connection[];
  readiness: Record<Capability, boolean>;
};
export type Request = (path: string, method?: string, body?: unknown) => Promise<unknown>;
export type LocalChoice = { id: string; name: string; capabilities: Capability[] };
export const capabilities = ["text", "vision", "transcription"] as const;
export const providerChoices = ["openai", "anthropic", "gemini", "groq", "openrouter", "ollama", "compatible", "deepgram", "assemblyai"];
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Resposta inválida do servidor.");
  return value as Record<string, unknown>;
}
export function string(value: unknown) {
  if (typeof value !== "string") throw Error("Resposta inválida do servidor.");
  return value;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw Error("Resposta inválida do servidor.");
  return value;
}
