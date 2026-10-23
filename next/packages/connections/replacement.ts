import type { Configuration, Connection } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
import { replacement } from "./contracts.ts";
import { validateConfiguration } from "./validation.ts";
function identity(connection: Pick<Connection, "provider" | "baseUrl">) {
  return `${connection.provider}:${connection.baseUrl.replace(/\/+$/, "")}`;
}
export function replaceConfiguration(previous: Configuration, input: unknown): Configuration {
  const parsed = replacement.safeParse(input);
  if (!parsed.success) throw new ConnectionError("connection_invalid");
  const next = parsed.data;
  if (previous.revision !== next.expectedRevision) throw new ConnectionError("connection_revision_conflict", 409);
  const secrets: Configuration["secrets"] = {};
  const connections = next.connections.map(({ secret, ...connection }): Connection => {
    const existing = previous.connections.find((item) => item.id === connection.id);
    if (existing ? existing.revision !== connection.revision : connection.revision !== 1)
      throw new ConnectionError("connection_revision_conflict", 409);
    const secretRef = connection.id;
    if (secret.operation === "replace") secrets[secretRef] = { kind: "saved", value: secret.value };
    if (secret.operation === "keep" && existing?.secretRef) {
      if (identity(existing) !== identity(connection)) throw new ConnectionError("connection_secret_origin_changed", 409);
      const saved = previous.secrets[existing.secretRef];
      if (!saved) throw new ConnectionError("connection_settings_unreadable", 503);
      secrets[secretRef] = structuredClone(saved);
    }
    return { ...connection, revision: existing ? existing.revision + 1 : 1,
      ...(secrets[secretRef] ? { secretRef } : {}) };
  });
  return validateConfiguration({ schemaVersion: 2, revision: previous.revision + 1,
    bindings: next.bindings, connections, secrets });
}
