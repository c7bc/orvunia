import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { join } from "node:path";
import { connectionRoutes } from "../../packages/connections/routes.ts";
import { connectionService } from "../../packages/connections/service.ts";
import { fileConfiguration } from "../../packages/connections/file.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { initialConfiguration, configurationInput, temporaryConnections } from "../support/connections.ts";
test("connection HTTP enforces auth, strict input and never returns keys or raw provider failures", async () => {
  const fixture = await temporaryConnections();
  try {
    const repository = fileConfiguration(join(fixture.directory, "config"), fileVault(join(fixture.directory, "key")));
    await repository.write(initialConfiguration());
    const service = connectionService({ repository, installationSupports: async () => false, environmentKey: () => "" });
    let inferenceCalls = 0;
    const app = new Elysia().use(connectionRoutes({ service,
      authorize: (request) => request.headers.get("authorization") === "synthetic-token" ? undefined : new Response(null, { status: 401 }),
      probe: { async test() { inferenceCalls++; throw Error("synthetic-secret-provider-error"); },
        async models() { return [{ id: "synthetic-catalog-model", capabilities: ["text"] }]; } },
    }));
    const request = (path: string, options?: RequestInit) => app.handle(new Request(`http://localhost${path}`, {
      ...options, headers: { authorization: "synthetic-token", "content-type": "application/json", ...options?.headers },
    }));
    expect((await app.handle(new Request("http://localhost/ai/connections"))).status).toBe(401);
    const state = await request("/ai/connections");
    expect(state.status).toBe(200); expect(await state.text()).not.toContain("synthetic-secret");
    expect((await request("/ai/connections/legacy-text/models")).status).toBe(200);
    expect(inferenceCalls).toBe(0);
    const failed = await request("/ai/connections/legacy-text/test", { method: "POST" });
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("synthetic-secret");
    expect(inferenceCalls).toBe(1);
    const invalid = await request("/ai/connections", { method: "PUT", body: JSON.stringify({
      ...configurationInput(initialConfiguration()), unexpected: "not-allowed",
    }) });
    expect(invalid.status).toBe(400); expect((await repository.read())?.revision).toBe(1);
  } finally { await fixture.cleanup(); }
});
