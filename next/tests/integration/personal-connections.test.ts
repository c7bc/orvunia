import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileConnections } from "../../packages/providers/file.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { providerDefaults } from "../../packages/providers/defaults.ts";
import { personalProviders } from "../../packages/providers/personal.ts";
import { loadLocalSettings } from "../../packages/config/local.ts";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";

test("personal v2 activation retains original encrypted settings and independent vision across legacy saves and restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-personal-connections-"));
  const database = sqliteConnection(join(directory, "cadence-next.sqlite"));
  await migrateSqlite(database);
  const models = composeLocalModels({ directory, database: database.client, bindings: async () => [] });
  try {
    const initial = providerDefaults({});
    initial.response.apiKey = "synthetic-original-key";
    const filename = join(directory, "providers.next.json");
    const vault = fileVault(`${filename}.key`, "cadence.providers/v1", 128 * 1024);
    await fileConnections(filename, vault).write(initial);
    const original = await readFile(filename);
    const settings = loadLocalSettings({ CADENCE_SQLITE_PATH: join(directory, "cadence-next.sqlite"),
      CADENCE_LOCAL_TOKEN: "synthetic-local-token".repeat(3), CADENCE_LOCAL_WORKSPACE: crypto.randomUUID() });
    let providers = await personalProviders(settings, { OPENAI_API_KEY: "synthetic-environment-key" }, models);
    let configuration = await providers.connections.public();
    expect(providers.effective("response").apiKey).toBe("synthetic-original-key");
    expect(providers.public().transcription.keySource).toBe("environment");
    const entries = configuration.connections.map(item => ({ id: item.id, revision: item.revision,
      provider: item.provider, baseUrl: item.baseUrl, model: item.model,
      capabilities: item.capabilities, parameters: item.parameters, secret: { operation: "keep" } }));
    await providers.connections.save({ schemaVersion: 2, expectedRevision: configuration.revision,
      bindings: { ...configuration.bindings, vision: { kind: "api", connectionId: "independent-vision" } },
      connections: [...entries, { id: "independent-vision", revision: 1, provider: "compatible",
        baseUrl: "https://vision.example.test/v1", model: "synthetic-visual-model", capabilities: ["vision"],
        parameters: {}, secret: { operation: "replace", value: "synthetic-vision-key" } }] });
    await providers.save({ response: { ...initial.response, model: "new-text-model", vision: false },
      transcription: initial.transcription });
    expect(await readFile(filename)).toEqual(original);
    providers = await personalProviders(settings, { OPENAI_API_KEY: "synthetic-environment-key" }, models);
    configuration = await providers.connections.public();
    expect(configuration.bindings.vision).toEqual({ kind: "api", connectionId: "independent-vision" });
    expect((await providers.connections.effective("independent-vision")).apiKey).toBe("synthetic-vision-key");
    expect(providers.effective("response").model).toBe("new-text-model");
    const visible = JSON.stringify(configuration);
    expect(visible).not.toContain("synthetic-original-key");
    expect(visible).not.toContain("synthetic-environment-key");
    expect(visible).not.toContain("synthetic-vision-key");
    expect((await readFile(join(directory, "providers.v2.json"), "utf8"))).not.toContain("synthetic-vision-key");
  } finally { await models.close(); database.close(); await rm(directory, { recursive: true, force: true }); }
});
