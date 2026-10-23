import { connectionInput } from "../contracts/providers.ts";
import type { Configuration } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
import type { Replacement } from "./contracts.ts";
export function legacyReplacement(current: Configuration, input: unknown): Replacement {
  const parsed = connectionInput.safeParse(input);
  if (!parsed.success) throw new ConnectionError("connection_invalid");
  const edits = new Map<string, Replacement["connections"][number]>();
  for (const role of ["response", "transcription"] as const) {
    const capability = role === "response" ? "text" : "transcription";
    const binding = current.bindings[capability];
    if (binding.kind !== "api") throw new ConnectionError("connection_revision_conflict", 409);
    const existing = current.connections.find((item) => item.id === binding.connectionId);
    if (!existing) throw new ConnectionError("connection_settings_unreadable", 503);
    const source = parsed.data[role];
    const sameOrigin = existing.provider === source.provider &&
      existing.baseUrl.replace(/\/+$/, "") === source.baseUrl.replace(/\/+$/, "");
    edits.set(existing.id, { id: existing.id, revision: existing.revision,
      provider: source.provider, baseUrl: source.baseUrl, model: source.model,
      capabilities: role === "response" ? parsed.data.response.vision ? ["text", "vision"] : ["text"] : ["transcription"],
      parameters: role === "response" ? { maxTokens: parsed.data.response.maxTokens, vision: parsed.data.response.vision } :
        { realtimeModel: parsed.data.transcription.realtimeModel },
      secret: source.clearKey ? { operation: "clear" } : source.apiKey ?
        { operation: "replace", value: source.apiKey } : { operation: sameOrigin ? "keep" : "clear" },
    });
  }
  const independentVision = ["api", "local"].includes(current.bindings.vision.kind);
  return { schemaVersion: 2, expectedRevision: current.revision,
    bindings: { ...current.bindings, vision: independentVision ? current.bindings.vision :
      parsed.data.response.vision ? { kind: "shared", capability: "text" } : { kind: "disabled" } },
    connections: current.connections.map((connection) => edits.get(connection.id) ?? {
      id: connection.id, provider: connection.provider, baseUrl: connection.baseUrl,
      model: connection.model, revision: connection.revision, capabilities: connection.capabilities,
      parameters: connection.parameters, secret: { operation: "keep" },
    }),
  };
}
