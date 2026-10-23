import type { Connections as LegacyConnections } from "../providers/domain.ts";
import type { Configuration } from "./domain.ts";
import { validateConfiguration } from "./validation.ts";
export function migrateConnections(legacy: LegacyConnections, environment?: {
  trusted(role: "response" | "transcription", provider: string, baseUrl: string): boolean;
}): Configuration {
  const secrets: Configuration["secrets"] = {};
  const connections = (["response", "transcription"] as const).map((role) => {
    const source = legacy[role];
    const id = role === "response" ? "legacy-text" : "legacy-transcription";
    const secretRef = `secret-${id}`;
    if (source.apiKey) secrets[secretRef] = { kind: "saved", value: source.apiKey };
    else if (environment?.trusted(role, source.provider, source.baseUrl))
      secrets[secretRef] = { kind: "environment", provider: source.provider, baseUrl: source.baseUrl, role };
    const result = {
      id, revision: 1, provider: source.provider, baseUrl: source.baseUrl, model: source.model,
      ...(secrets[secretRef] ? { secretRef } : {}),
    };
    if (role === "response") return { ...result,
      capabilities: legacy.response.vision ? ["text", "vision"] as const : ["text"] as const,
      parameters: { maxTokens: legacy.response.maxTokens, vision: legacy.response.vision } };
    return { ...result, capabilities: ["transcription"] as const,
      parameters: { realtimeModel: legacy.transcription.realtimeModel } };
  }).map((item) => ({ ...item, capabilities: [...item.capabilities] }));
  return validateConfiguration({ schemaVersion: 2, revision: 1, connections, secrets,
    bindings: { text: { kind: "api", connectionId: "legacy-text" },
      vision: legacy.response.vision ? { kind: "shared", capability: "text" } : { kind: "disabled" },
      transcription: { kind: "api", connectionId: "legacy-transcription" } } });
}
