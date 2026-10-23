import type { Configuration, Capability } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
export function validateConfiguration(value: Configuration) {
  const identifiers = new Set(value.connections.map((connection) => connection.id));
  if (identifiers.size !== value.connections.length) throw new ConnectionError("connection_invalid");
  const usedSecrets = new Set<string>();
  for (const connection of value.connections) {
    const capabilities = new Set(connection.capabilities);
    if (capabilities.size !== connection.capabilities.length) throw new ConnectionError("connection_invalid");
    if (["deepgram", "assemblyai"].includes(connection.provider) &&
      connection.capabilities.some((item) => item !== "transcription")) throw new ConnectionError("connection_invalid");
    if (["anthropic", "gemini", "openrouter", "ollama"].includes(connection.provider) &&
      capabilities.has("transcription")) throw new ConnectionError("connection_invalid");
    if (connection.secretRef) {
      const secret = Object.hasOwn(value.secrets, connection.secretRef) ? value.secrets[connection.secretRef] : undefined;
      if (!secret) throw new ConnectionError("connection_invalid");
      if (secret.kind === "environment" &&
        (secret.provider !== connection.provider || secret.baseUrl !== connection.baseUrl))
        throw new ConnectionError("connection_secret_origin_changed");
      usedSecrets.add(connection.secretRef);
    }
  }
  if (Object.keys(value.secrets).some((key) => !usedSecrets.has(key))) throw new ConnectionError("connection_invalid");
  for (const capability of ["text", "vision", "transcription"] as const) {
    const binding = value.bindings[capability];
    if (binding.kind === "shared") {
      const text = value.bindings.text;
      if (text.kind === "disabled") throw new ConnectionError("connection_invalid");
      if (text.kind === "api") requireCapability(text.connectionId, "vision");
    } else if (binding.kind === "api") requireCapability(binding.connectionId, capability);
  }
  function requireCapability(id: string, capability: Capability) {
    const connection = value.connections.find((item) => item.id === id);
    if (!connection?.capabilities.includes(capability)) throw new ConnectionError("connection_invalid", 422);
  }
  return value;
}
