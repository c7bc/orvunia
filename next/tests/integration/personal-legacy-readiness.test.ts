import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalSettings } from "../../packages/config/local.ts";
import { personalProviders } from "../../packages/providers/personal.ts";
import { capabilityEnvironment } from "../support/capability-environment.ts";

test("real personal facade distinguishes local capability readiness from legacy API readiness", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-legacy-readiness-"));
  const environment = await capabilityEnvironment();
  try {
    const settings = loadLocalSettings({ CADENCE_SQLITE_PATH: join(directory, "personal.sqlite"),
      CADENCE_LOCAL_TOKEN: "synthetic-local-token".repeat(3), CADENCE_LOCAL_WORKSPACE: environment.owner });
    const installations: Parameters<typeof personalProviders>[2] = {
      installationSupports: async () => true, withConfigurationMutation: action => action(),
    };
    let providers = await personalProviders(settings, { OPENAI_API_KEY: "synthetic-environment-key" }, installations);
    expect(providers.legacyReady("response")).toBe(true);
    const configuration = await providers.connections.public();
    await providers.connections.save({ schemaVersion: 2, expectedRevision: configuration.revision,
      bindings: { text: { kind: "local", installationId: "synthetic-installed-model" },
        vision: { kind: "shared", capability: "text" },
        transcription: { kind: "local", installationId: "synthetic-installed-model" } },
      connections: configuration.connections.map(item => ({ id: item.id, revision: item.revision,
        provider: item.provider, baseUrl: item.baseUrl, model: item.model, capabilities: item.capabilities,
        parameters: item.parameters, secret: { operation: "keep" } })),
    });
    providers = await personalProviders(settings, { OPENAI_API_KEY: "synthetic-environment-key" }, installations);
    expect(providers.ready("response")).toBe(true);
    expect(providers.ready("transcription")).toBe(true);
    expect(providers.legacyReady("response")).toBe(false);
    expect(providers.legacyReady("transcription")).toBe(false);
    const prepared = await environment.prepare();
    if (prepared.snapshot?.version !== 2) throw Error("Expected v2 fixture");
    const { capabilities: _capabilities, ...snapshot } = prepared.snapshot;
    const current = providers.effective("response");
    const operation = { ...prepared, snapshot: { ...snapshot, version: 1 as const,
      provider: { provider: current.provider, baseUrl: current.baseUrl, model: current.model,
        maxTokens: current.maxTokens, vision: current.vision } } };
    environment.dependencies.providers = providers;
    await expect(environment.run(operation)).rejects.toMatchObject({ code: "provider_not_configured", status: 503 });
    expect(environment.requests).toHaveLength(0);
    expect(environment.connection.client.query("SELECT COUNT(*) AS count FROM next_usage").get()).toEqual({ count: 0 });
  } finally { await environment.close(); await rm(directory, { recursive: true, force: true }); }
});
