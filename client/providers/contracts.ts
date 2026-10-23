export const providerCatalogs = {
  response: [
    "openai",
    "anthropic",
    "gemini",
    "groq",
    "openrouter",
    "ollama",
    "compatible",
  ],
  transcription: ["openai", "groq", "deepgram", "assemblyai", "compatible"],
} as const;
export type ProviderKind = keyof typeof providerCatalogs;
export type PublicConnection = {
  provider: string;
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  keySource: "saved" | "environment" | "none";
  vision?: boolean;
  maxTokens?: number;
  realtimeModel?: string;
};
export type PersonalProviderState = {
  edition?: "personal";
  editable: boolean;
  response: PublicConnection;
  transcription: PublicConnection;
  presets: Record<string, { label: string; baseUrl: string }>;
  protection: "os" | "file" | "managed";
  loadError?: string;
};
export type ManagedProviderState = { edition: "cloud"; editable: false; protection: "managed" };
export type ProviderState = PersonalProviderState | ManagedProviderState;
export type ProviderApi = (
  path: string,
  method: "PUT" | "POST",
  body: unknown,
) => Promise<unknown>;
export type ProviderBindings = {
  state: ProviderState;
  api: ProviderApi;
  toast(message: string): void;
  onSaved(state: ProviderState): void | Promise<void>;
  root?: Document;
};
export function providerState(value: unknown): ProviderState {
  if (!value || typeof value !== "object")
    throw Error("Configuração de provedores inválida.");
  const record = value as Record<string, unknown>;
  if (record.edition === "cloud" || record.editable === false)
    return { edition: "cloud", editable: false, protection: "managed" };
  if (
    typeof record.editable !== "boolean" ||
    !["os", "file", "managed"].includes(String(record.protection)) ||
    !record.presets ||
    typeof record.presets !== "object"
  )
    throw Error("Configuração de provedores inválida.");
  for (const kind of ["response", "transcription"] as const) {
    const connection = record[kind];
    if (
      !connection ||
      typeof connection !== "object" ||
      !("provider" in connection) ||
      !providerCatalogs[kind].some(
        (provider) => provider === connection.provider,
      ) ||
      !("model" in connection) ||
      typeof connection.model !== "string" ||
      !("baseUrl" in connection) ||
      typeof connection.baseUrl !== "string" ||
      !("keyConfigured" in connection) ||
      typeof connection.keyConfigured !== "boolean" ||
      !("keySource" in connection) ||
      !["saved", "environment", "none"].includes(String(connection.keySource))
    )
      throw Error("Configuração de provedores inválida.");
  }
  for (const preset of Object.values(record.presets))
    if (
      !preset ||
      typeof preset !== "object" ||
      !("label" in preset) ||
      typeof preset.label !== "string" ||
      !("baseUrl" in preset) ||
      typeof preset.baseUrl !== "string"
    )
      throw Error("Configuração de provedores inválida.");
  return value as ProviderState;
}
export function providerModels(value: unknown): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("models" in value) ||
    !Array.isArray(value.models) ||
    value.models.length > 10000 ||
    !value.models.every(
      (model) => typeof model === "string" && model.length <= 500,
    )
  )
    throw Error("Lista de modelos inválida.");
  return value.models;
}
