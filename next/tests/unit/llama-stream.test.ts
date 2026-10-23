import { expect, test } from "bun:test";
import { readLlamaStream } from "../../packages/local-models/llama-stream.ts";

const event = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const content = (value: string) => event({ choices: [{ delta: { content: value } }] });
const response = (value: string) => new Response(value, { headers: { "content-type": "text/event-stream" } });

test("fragmented UTF-8 SSE measures first nonempty content and server tokens/timing, ignoring role/empty events", async () => {
  const bytes = new TextEncoder().encode(event({ choices: [{ delta: { role: "assistant", content: "" } }] })
    + content("ação") + content(" útil") + event({ timings: { predicted_n: 4, predicted_ms: 200 }, usage: { completion_tokens: 4 } }) + "data: [DONE]\r\n\r\n");
  let offset = 0; let clockCalls = 0; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset < bytes.length) controller.enqueue(bytes.subarray(offset, ++offset)); else controller.close();
  }, cancel() { cancelled = true; } });
  const result = await readLlamaStream(new Response(stream, { headers: { "content-type": "text/event-stream" } }),
    new AbortController().signal, 100, () => { clockCalls++; return 450; });
  expect(result.output).toBe("ação útil"); expect(clockCalls).toBe(1);
  expect(result.telemetry).toMatchObject({ timeToFirstTokenMilliseconds: 350, tokensPerSecond: 20,
    generatedTokens: 4, generationMilliseconds: 200, provenance: {
      timeToFirstToken: "client-monotonic-first-content", tokensPerSecond: "llama-predicted-n-over-predicted-ms" } });
  expect(cancelled).toBe(true);
});

for (const timings of [{ predicted_n: 4, predicted_ms: 0 }, { predicted_n: "4", predicted_ms: 50 },
  { predicted_n: 2, predicted_ms: 1e-323 }, { predicted_n: 1.5, predicted_ms: 50 }, { predicted_n: 1e999, predicted_ms: 50 }])
  test(`invalid runtime timing cannot become fabricated or infinite tokens/s: ${JSON.stringify(timings)}`, async () => {
    const result = await readLlamaStream(response(content("answer") + event({ timings }) + "data: [DONE]\n\n"), new AbortController().signal, 0);
    expect(result.telemetry.tokensPerSecond).toBeNull(); expect(result.telemetry.provenance.tokensPerSecond).toBeNull();
    expect(result.telemetry.unavailableReasons).toContain("tokens-per-second:missing-valid-runtime-timings");
  });

test("usage without generation duration preserves count but cannot infer speed from final latency", async () => {
  const result = await readLlamaStream(response(content("answer") + event({ usage: { completion_tokens: 5 } }) + "data: [DONE]\n\n"), new AbortController().signal, 0);
  expect(result.telemetry.generatedTokens).toBe(5); expect(result.telemetry.generationMilliseconds).toBeNull();
  expect(result.telemetry.tokensPerSecond).toBeNull();
});

for (const value of [content("incomplete"), "data: badjson\n\n", content("") + "data: [DONE]\n\n",
  event({ choices: [{ delta: { content: 2 } }] }) + "data: [DONE]\n\n", ":".repeat(256 * 1024 + 1)])
  test("malformed/incomplete/oversized SSE fails instead of returning partial success", async () => {
    await expect(readLlamaStream(response(value), new AbortController().signal, 0)).rejects.toMatchObject({ code: "local_generation_invalid" });
  });

test("abort cancels the reader and waits for its drain before returning", async () => {
  const controller = new AbortController(); let cancelled = false; let finish!: () => void;
  const drain = new Promise<void>(resolve => { finish = resolve; });
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; return drain; } });
  let settled = false;
  const pending = readLlamaStream(new Response(stream, { headers: { "content-type": "text/event-stream" } }), controller.signal, 0)
    .catch(error => { settled = true; return error; });
  controller.abort(new Error("controlled abort")); await Bun.sleep(0);
  expect(cancelled).toBe(true); expect(settled).toBe(false);
  finish(); expect((await pending).message).toBe("controlled abort");
});

test("stream enforces total byte and output limits even when each event is individually bounded", async () => {
  let pulls = 0; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    pulls++; controller.enqueue(new TextEncoder().encode(":" + "x".repeat(100_000) + "\n\n"));
  }, cancel() { cancelled = true; } });
  await expect(readLlamaStream(new Response(stream, { headers: { "content-type": "text/event-stream" } }),
    new AbortController().signal, 0)).rejects.toMatchObject({ code: "local_generation_invalid" });
  expect(pulls).toBeLessThan(45); expect(cancelled).toBe(true);
  await expect(readLlamaStream(response(content("x".repeat(128 * 1024 + 1)) + "data: [DONE]\n\n"),
    new AbortController().signal, 0)).rejects.toMatchObject({ code: "local_generation_invalid" });
});
