import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { providerStream } from "../support/provider-stream.ts";

async function capture(environment: Awaited<ReturnType<typeof capabilityEnvironment>>) {
  return environment.imageService.upload(environment.owner, environment.session.id, {
    data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic signature fixture",
    time: "00:01", requestKey: crypto.randomUUID(),
  });
}
test("v2 routes image evidence and final answer to separate connections, retaining stages across confirmed retry", async () => {
  const environment = await capabilityEnvironment();
  try {
    await capture(environment);
    let rejectText = true;
    environment.upstream(async (url) => {
      if (String(url).includes("text.") && rejectText) return Response.json({ error: { message: "synthetic rejection" } }, { status: 401 });
      return providerStream([{ type: "response.output_text.delta", delta: String(url).includes("vision.") ? "Visible code question" : "Final answer" },
        { type: "response.completed", response: {} }]);
    });
    const original = await environment.prepare();
    expect(original.snapshot?.version).toBe(2);
    expect(JSON.stringify(original.snapshot)).not.toContain("synthetic-text-secret");
    await expect(environment.run(original)).rejects.toMatchObject({ code: "provider_auth" });
    expect(environment.requests.map((request) => new URL(request.url).hostname)).toEqual(["vision.fixture.test", "text.fixture.test"]);
    environment.change((configuration) => { configuration.revision++; configuration.connections[0]!.model = "changed-after-prepare"; });
    rejectText = false;
    const retry = await environment.prepare(); expect(retry.snapshot).toEqual(original.snapshot);
    expect((await environment.run(retry)).text).toBe("Final answer");
    expect(environment.requests.filter((request) => request.url.includes("vision.")).length).toBe(1);
    const textCalls = environment.requests.filter((request) => request.url.includes("text."));
    expect(textCalls[1]!.body.model).toBe("text-snapshot");
    expect(JSON.stringify(textCalls[1]!.body)).toContain("untrusted_visual_evidence");
    expect(JSON.stringify(textCalls[1]!.body)).not.toContain("input_image");
    const replay = await environment.run(await environment.prepare()); expect(replay.text).toBe("Final answer");
    expect(environment.requests).toHaveLength(3);
  } finally { await environment.close(); }
});
test("uncertain visual call is recorded unknown and can never silently repeat", async () => {
  const environment = await capabilityEnvironment();
  try {
    await capture(environment); environment.upstream(async () => { throw Error("uncertain upstream delivery"); });
    await expect(environment.run(await environment.prepare())).rejects.toMatchObject({ code: "provider_unavailable" });
    await expect(environment.prepare()).rejects.toMatchObject({ code: "operation_unknown" });
    const stage = environment.connection.client.query<{ state: string }, []>("SELECT state FROM next_operation_stages").get();
    expect(stage?.state).toBe("unknown"); expect(environment.requests).toHaveLength(1);
  } finally { await environment.close(); }
});
test("shared vision takes one generation call and plain text never invokes an independent vision connection", async () => {
  const environment = await capabilityEnvironment();
  try {
    environment.change((configuration) => { configuration.connections[0]!.capabilities.push("vision"); configuration.bindings.vision = { kind: "shared", capability: "text" }; });
    await capture(environment);
    await environment.run(await environment.prepare());
    expect(environment.requests).toHaveLength(1);
    expect(JSON.stringify(environment.requests[0]!.body)).toContain("input_image");
    environment.input.requestId = crypto.randomUUID(); environment.input.captureIds = [];
    environment.change((configuration) => { configuration.bindings.vision = { kind: "api", connectionId: "vision" }; });
    await environment.run(await environment.prepare());
    expect(environment.requests).toHaveLength(2);
    expect(environment.requests.every((request) => request.url.includes("text."))).toBe(true);
  } finally { await environment.close(); }
});
