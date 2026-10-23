import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";

test("v1 retries cannot silently use the default API after text is rebound to a local model", async () => {
  const environment = await capabilityEnvironment();
  try {
    const prepared = await environment.prepare();
    if (prepared.snapshot?.version !== 2) throw Error("Expected a persisted v2 snapshot");
    const { capabilities: _capabilities, ...snapshot } = prepared.snapshot;
    const operation = { ...prepared, snapshot: { ...snapshot, version: 1 as const } };
    const original = environment.dependencies.providers;
    environment.dependencies.providers = { ...original, ready: () => false };
    await expect(environment.run(operation)).rejects.toMatchObject({ code: "provider_not_configured", status: 503 });
    expect(environment.requests).toEqual([]);
    expect(environment.connection.client.query("SELECT COUNT(*) AS count FROM next_usage").get()).toEqual({ count: 0 });
    const repository = environment.dependencies.operations;
    environment.dependencies.operations = { ...repository,
      find: async () => operation,
    };
    await expect(environment.prepare()).rejects.toMatchObject({ code: "provider_not_configured", status: 503 });
  } finally { await environment.close(); }
});
