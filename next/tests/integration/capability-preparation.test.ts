import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";

for (const visual of [false, true]) {
  test(`resource acquisition rejection remains retryable without repeating completed vision: images=${visual}`, async () => {
    const environment = await capabilityEnvironment();
    try {
      if (visual) await environment.imageService.upload(environment.owner, environment.session.id, {
        data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic image",
        time: "00:01", requestKey: crypto.randomUUID(),
      });
      let blocked = true;
      const router = environment.router;
      environment.dependencies.capabilities = { ...router, async acquireText(plan, signal) {
        if (blocked) throw new LocalModelError("hardware_incompatible", 409);
        return router.acquireText(plan, signal);
      } };
      const operation = await environment.prepare();
      await expect(environment.run(operation)).rejects.toMatchObject({ code: "hardware_incompatible", status: 409 });
      expect((await environment.operations.find(environment.owner, "answer", operation.id))?.state).toBe("failed");
      expect(environment.requests).toHaveLength(visual ? 1 : 0);
      expect(environment.connection.client.query("SELECT state FROM next_usage").all()).toEqual([{ state: "released" }]);
      blocked = false;
      const result = await environment.run(await environment.prepare());
      expect(result.text).toBe("Final technical answer");
      expect(environment.requests.filter(request => request.url.includes("vision."))).toHaveLength(visual ? 1 : 0);
      expect(environment.requests.filter(request => request.url.includes("text."))).toHaveLength(1);
      expect(await environment.sessions.entries(environment.owner, environment.session.id, "responses", { limit: 10 })).toHaveLength(1);
      expect(environment.connection.client.query("SELECT COUNT(*) AS count FROM next_usage WHERE state='committed'").get()).toEqual({ count: 1 });
    } finally { await environment.close(); }
  });
}

test("vision acquisition rejection leaves both parent operation and stage retryable", async () => {
  const environment = await capabilityEnvironment();
  try {
    await environment.imageService.upload(environment.owner, environment.session.id, {
      data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic image",
      time: "00:01", requestKey: crypto.randomUUID(),
    });
    let blocked = true;
    environment.dependencies.capabilities = { ...environment.router, async acquireVision(plan, signal) {
      if (blocked) throw new LocalModelError("runtime_busy", 409);
      return environment.router.acquireVision(plan, signal);
    } };
    await expect(environment.run(await environment.prepare())).rejects.toMatchObject({ code: "runtime_busy" });
    expect(environment.requests).toHaveLength(0);
    expect(environment.connection.client.query("SELECT state FROM next_operation_stages").get()).toEqual({ state: "failed" });
    blocked = false;
    expect((await environment.run(await environment.prepare())).text).toBe("Final technical answer");
    expect(environment.requests).toHaveLength(2);
  } finally { await environment.close(); }
});
