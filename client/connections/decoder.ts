import { object, list, string, capabilities } from "./domain.js";
import type { Binding, Capability, Configuration } from "./domain.js";
function positive(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw Error("Revisão inválida.");
  return value;
}
function binding(value: unknown, capability: Capability): Binding {
  const source = object(value);
  if (source.kind === "disabled") return { kind: "disabled" };
  if (source.kind === "api") return { kind: "api", connectionId: string(source.connectionId) };
  if (source.kind === "local") return { kind: "local", installationId: string(source.installationId) };
  if (source.kind === "shared" && capability === "vision" && source.capability === "text") return { kind: "shared", capability: "text" };
  throw Error("Conexão inválida.");
}
export function readConnections(value: unknown): Configuration {
  const source = object(value), assignments = object(source.bindings), ready = object(source.readiness);
  if (source.schemaVersion !== 2) throw Error("Versão de conexões inválida.");
  return { schemaVersion: 2, revision: positive(source.revision),
    bindings: { text: binding(assignments.text, "text"), vision: binding(assignments.vision, "vision"),
      transcription: binding(assignments.transcription, "transcription") },
    readiness: { text: ready.text === true, vision: ready.vision === true, transcription: ready.transcription === true },
    connections: list(source.connections).map((item) => {
      const entry = object(item), parameters = object(entry.parameters);
      return { id: string(entry.id), revision: positive(entry.revision), provider: string(entry.provider),
        baseUrl: string(entry.baseUrl), model: string(entry.model), keyConfigured: entry.keyConfigured === true,
        keySource: string(entry.keySource), capabilities: list(entry.capabilities).map((item) => {
          if (!capabilities.includes(item as Capability)) throw Error("Capacidade inválida.");
          return item as Capability;
        }), parameters: {
          ...(typeof parameters.maxTokens === "number" ? { maxTokens: parameters.maxTokens } : {}),
          ...(typeof parameters.vision === "boolean" ? { vision: parameters.vision } : {}),
          ...(typeof parameters.realtimeModel === "string" ? { realtimeModel: parameters.realtimeModel } : {}),
        } };
    }) };
}
