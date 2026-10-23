import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Connections } from "../../packages/providers/domain.ts";
import { migrateConnections } from "../../packages/connections/migration.ts";
import type { Configuration } from "../../packages/connections/domain.ts";
export function legacyConnections(vision = true): Connections {
  return { response: { provider: "openai", baseUrl: "https://api.example.test/v1",
    model: "synthetic-text", apiKey: "synthetic-secret-one", vision, maxTokens: 3000 },
  transcription: { provider: "deepgram", baseUrl: "https://speech.example.test/v1",
    model: "synthetic-speech", apiKey: "synthetic-secret-two", realtimeModel: "synthetic-live" } };
}
export function configurationInput(value: Configuration) {
  return { schemaVersion: 2 as const, expectedRevision: value.revision, bindings: value.bindings,
    connections: value.connections.map(({ secretRef: _secretRef, ...connection }) => ({
      ...connection, secret: { operation: "keep" as const },
    })) };
}
export const initialConfiguration = () => migrateConnections(legacyConnections());
export async function temporaryConnections() {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-connections-"));
  return { directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
