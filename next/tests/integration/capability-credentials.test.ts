import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";

test("an unconfigured API capability fails before network I/O or a usage reservation", async () => {
  const environment = await capabilityEnvironment();
  try {
    environment.change(configuration => {
      const connection = configuration.connections.find(item => item.id === "text")!;
      delete connection.secretRef;
      delete configuration.secrets["text-key"];
    });
    const operation = await environment.service.prepare(environment.owner, environment.session.id,
      { ...environment.input, captureIds: [] }, false);
    await expect(environment.run(operation)).rejects.toMatchObject({ code: "provider_not_configured", status: 503 });
    expect(environment.requests).toEqual([]);
    expect(environment.connection.client.query("SELECT COUNT(*) AS count FROM next_usage").get()).toEqual({ count: 0 });
    expect(await environment.sessions.entries(environment.owner, environment.session.id, "responses", { limit: 10 })).toEqual([]);
  } finally { await environment.close(); }
});
