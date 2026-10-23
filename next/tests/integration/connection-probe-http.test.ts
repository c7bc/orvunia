import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { join } from "node:path";
import { connectionRoutes } from "../../packages/connections/routes.ts";
import { connectionService } from "../../packages/connections/service.ts";
import { fileConfiguration } from "../../packages/connections/file.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { connectionProbe } from "../../packages/providers/connection-probe.ts";
import { initialConfiguration, temporaryConnections } from "../support/connections.ts";

for (const capability of ["text", "vision"] as const) {
  test(`HTTP ${capability} connection probe reaches injected transport with valid token limit`, async () => {
    const fixture = await temporaryConnections();
    try {
      const configuration = initialConfiguration();
      configuration.connections[0]!.capabilities = [capability];
      configuration.bindings.text = capability === "text" ? { kind: "api", connectionId: "legacy-text" } : { kind: "disabled" };
      configuration.bindings.vision = capability === "vision" ? { kind: "api", connectionId: "legacy-text" } : { kind: "disabled" };
      const repository = fileConfiguration(join(fixture.directory, "config"), fileVault(join(fixture.directory, "key")));
      await repository.write(configuration);
      const service = connectionService({ repository, installationSupports: async () => false, environmentKey: () => "" });
      let calls = 0;
      const app = new Elysia().use(connectionRoutes({ service, authorize: () => {},
        probe: connectionProbe(async (input, options) => {
          calls++;
          expect(String(input)).toBe("https://api.example.test/v1/responses");
          const body = JSON.parse(String(options?.body));
          expect(body.max_output_tokens).toBe(128);
          expect(body.store).toBe(false);
          const images = body.input[0].content.filter((item: { type: string }) => item.type === "input_image");
          expect(images.length).toBe(capability === "vision" ? 1 : 0);
          if (capability === "vision") expect(images[0].image_url).toStartWith("data:image/png;base64,");
          const events = [
            { type: "response.output_text.delta", delta: "OK" },
            { type: "response.completed", response: {} },
          ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
          return new Response(events, { headers: { "content-type": "text/event-stream" } });
        }),
      }));
      const response = await app.handle(new Request("http://localhost/ai/connections/legacy-text/test", { method: "POST" }));
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.ready).toBe(true);
      expect(result.capabilities).toEqual([capability]);
      expect(result.requestId).toBeString();
      expect(JSON.stringify(result)).not.toContain("synthetic-secret");
      expect(calls).toBe(1);
    } finally { await fixture.cleanup(); }
  });
}

test("HTTP model enumeration preserves mixed identifiers without claiming unverified capabilities", async () => {
  const fixture = await temporaryConnections();
  try {
    const repository = fileConfiguration(join(fixture.directory, "config"), fileVault(join(fixture.directory, "key")));
    await repository.write(initialConfiguration());
    const service = connectionService({ repository, installationSupports: async () => false, environmentKey: () => "" });
    const ids = ["synthetic-transcription", "synthetic-embedding", "synthetic-text", "synthetic-vision"];
    let calls = 0;
    const app = new Elysia().use(connectionRoutes({ service, authorize: () => {},
      probe: connectionProbe(async (input, options) => {
        calls++;
        expect(String(input)).toBe("https://api.example.test/v1/models");
        expect(options?.body).toBeUndefined();
        return Response.json({ data: ids.map(id => ({ id })) });
      }),
    }));
    const response = await app.handle(new Request("http://localhost/ai/connections/legacy-text/models"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ids.map(id => ({ id, capabilities: [] })) });
    expect(calls).toBe(1);
  } finally { await fixture.cleanup(); }
});
