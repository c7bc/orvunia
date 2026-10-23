import { test, expect } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";

for (const code of ["runtime_busy", "runtime_not_loaded"] as const) for (const scenario of [
  { images: false, phase: "text" }, { images: true, phase: "text" }, { images: true, phase: "vision" },
] as const) test(`pre-request ${code} is retryable with visual checkpoints intact: ${JSON.stringify(scenario)}`, async () => {
  const environment = await capabilityEnvironment();
  let blocked = true;
  const router = environment.router;
  try {
    if (scenario.images) await environment.imageService.upload(environment.owner, environment.session.id, {
      data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic audit image",
      time: "00:01", requestKey: crypto.randomUUID(),
    });
    const busy = { provider: { async answer() { throw new LocalModelError(code, 409); } }, async release() {} };
    environment.dependencies.capabilities = { ...router,
      async acquireText(plan, signal) { return blocked && scenario.phase === "text" ? busy : router.acquireText(plan, signal); },
      async acquireVision(plan, signal) { return blocked && scenario.phase === "vision" ? busy : router.acquireVision(plan, signal); },
    };
    const operation = await environment.prepare();
    await expect(environment.run(operation)).rejects.toMatchObject({ code, status: 409 });
    expect((await environment.operations.find(environment.owner, "answer", operation.id))?.state).toBe("failed");
    expect(environment.connection.client.query("SELECT state FROM next_usage").all()).toEqual([{ state: "released" }]);
    expect(environment.requests.filter(request => request.url.includes("text."))).toHaveLength(0);
    if (scenario.images) expect(environment.connection.client.query("SELECT state FROM next_operation_stages").get())
      .toEqual({ state: scenario.phase === "text" ? "completed" : "failed" });
    blocked = false;
    expect((await environment.run(await environment.prepare())).text).toBe("Final technical answer");
    expect(environment.requests.filter(request => request.url.includes("vision."))).toHaveLength(scenario.images ? 1 : 0);
    expect(environment.requests.filter(request => request.url.includes("text."))).toHaveLength(1);
    expect((await environment.sessions.counts(environment.owner, environment.session.id)).responses).toBe(1);
    expect(environment.connection.client.query("SELECT COUNT(*) AS n FROM next_usage WHERE state='committed'").get()).toEqual({ n: 1 });
  } finally { await environment.close(); }
});

for (const phase of ["text", "vision"] as const)
  test(`ambiguous ${phase} transport failure remains unknown and cannot repeat the request`, async () => {
    const environment = await capabilityEnvironment();
    let attempts = 0;
    try {
      if (phase === "vision") await environment.imageService.upload(environment.owner, environment.session.id, {
        data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic audit image",
        time: "00:01", requestKey: crypto.randomUUID(),
      });
      const uncertain = { provider: { async answer() { attempts++; throw TypeError("Synthetic transport outcome lost"); } }, async release() {} };
      environment.dependencies.capabilities = { ...environment.router,
        ...(phase === "text" ? { acquireText: async () => uncertain } : { acquireVision: async () => uncertain }) };
      const operation = await environment.prepare();
      await expect(environment.run(operation)).rejects.toThrow("Synthetic transport outcome lost");
      expect((await environment.operations.find(environment.owner, "answer", operation.id))?.state).toBe("unknown");
      expect(environment.connection.client.query("SELECT state FROM next_usage").all()).toEqual([{ state: "unknown" }]);
      await expect(environment.prepare()).rejects.toMatchObject({ code: "operation_unknown" });
      expect(attempts).toBe(1);
      if (phase === "vision") expect(environment.connection.client.query("SELECT state FROM next_operation_stages").get()).toEqual({ state: "unknown" });
    } finally { await environment.close(); }
  });
