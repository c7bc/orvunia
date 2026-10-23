import type { Configuration, Connection, Capability, Repository, Secret } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
import { replaceConfiguration } from "./replacement.ts";
export type ConnectionDependencies = {
  repository: Repository;
  installationSupports(id: string, capability: Capability): Promise<boolean>;
  environmentKey(secret: Extract<Secret, { kind: "environment" }>): string;
};
export function connectionService(dependencies: ConnectionDependencies) {
  async function read() {
    const value = await dependencies.repository.read();
    if (!value) throw new ConnectionError("connection_settings_unreadable", 503);
    return value;
  }
  function key(value: Configuration, connection: Connection) {
    const secret = connection.secretRef ? value.secrets[connection.secretRef] : undefined;
    return secret?.kind === "saved" ? secret.value : secret ? dependencies.environmentKey(secret) : "";
  }
  async function publicConfiguration(value: Configuration) {
    const connections = value.connections.map(({ secretRef, ...connection }) => {
      const secret = secretRef ? value.secrets[secretRef] : undefined;
      return { ...connection, keyConfigured: Boolean(key(value, { ...connection, ...(secretRef ? { secretRef } : {}) })),
        keySource: secret?.kind === "saved" ? "saved" : secret?.kind === "environment" ? "environment" : "none" };
    });
    const readiness = { text: false, vision: false, transcription: false };
    for (const capability of ["text", "vision", "transcription"] as const) {
      const original = value.bindings[capability];
      const binding = original.kind === "shared" ? value.bindings.text : original;
      if (binding.kind === "local") readiness[capability] = await dependencies.installationSupports(binding.installationId, capability);
      if (binding.kind === "api") {
        const connection = value.connections.find((item) => item.id === binding.connectionId);
        readiness[capability] = Boolean(connection?.capabilities.includes(capability) &&
          (key(value, connection) || ["ollama", "compatible"].includes(connection.provider)));
      }
    }
    return { schemaVersion: 2 as const, revision: value.revision,
      bindings: value.bindings, connections, readiness };
  }
  return {
    async public() { return publicConfiguration(await read()); },
    async effective(id: string) {
      const value = await read();
      const connection = value.connections.find((item) => item.id === id);
      if (!connection) throw new ConnectionError("connection_not_found", 404);
      const { secretRef: _secretRef, ...descriptor } = connection;
      return { ...descriptor, apiKey: key(value, connection) };
    },
    async configuration() { return structuredClone(await read()); },
    async save(input: unknown) {
      return dependencies.repository.transaction(async () => {
        const next = replaceConfiguration(await read(), input);
        for (const capability of ["text", "vision", "transcription"] as const) {
          const original = next.bindings[capability];
          const binding = original.kind === "shared" ? next.bindings.text : original;
          if (binding.kind === "local" && !await dependencies.installationSupports(binding.installationId, capability))
            throw new ConnectionError("connection_invalid", 422);
        }
        await dependencies.repository.write(next);
        return publicConfiguration(next);
      });
    },
  };
}
export type ConnectionService = ReturnType<typeof connectionService>;
