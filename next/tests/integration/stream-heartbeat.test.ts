import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { eventStream } from "../../packages/http/stream.ts";

test("silent inference survives the real server idle deadline without fake answer deltas", async () => {
  const application = new Elysia().get("/events", ({ request }) =>
    eventStream(request, async () => {
      await Bun.sleep(14_500);
      return { text: "Final synthetic answer" };
    }),
  ).get("/silent", async () => {
    await Bun.sleep(14_500);
    return "No heartbeat";
  }).listen({ hostname: "127.0.0.1", port: 0, idleTimeout: 10 });
  try {
    const silentConnection = fetch(`http://127.0.0.1:${application.server!.port}/silent`, {
      signal: AbortSignal.timeout(22_000),
    }).then(() => false, () => true);
    const response = await fetch(`http://127.0.0.1:${application.server!.port}/events`, {
      signal: AbortSignal.timeout(22_000),
    });
    const stream = await response.text();
    expect(response.status).toBe(200);
    expect(stream).toContain(": keep-alive\n\n");
    expect(stream).toContain('event: done\ndata: {"text":"Final synthetic answer"}');
    expect(stream).not.toContain("event: delta");
    expect(stream).not.toContain("event: error");
    expect(await silentConnection).toBe(true);
  } finally { await application.stop(); }
}, 25_000);

test("consumer cancellation aborts a silent generation after a heartbeat", async () => {
  const aborted = Promise.withResolvers<void>();
  const response = eventStream(new Request("http://localhost/events"), signal =>
    new Promise((_, reject) => signal.addEventListener("abort", () => {
      aborted.resolve();
      reject(signal.reason);
    }, { once: true })),
  );
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(": keep-alive\n\n");
  await reader.cancel();
  await aborted.promise;
  expect((await reader.read()).done).toBe(true);
}, 10_000);
