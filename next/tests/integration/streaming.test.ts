import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { z } from "zod";

test("Bun/Elysia preserves SSE framing and propagates disconnect cancellation", async () => {
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const cancel = () => {
    cancelled = true;
    clearInterval(timer);
  };
  const app = new Elysia()
    .get("/stream", ({ request }) => {
      request.signal.addEventListener("abort", cancel, { once: true });
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('id: 1\nevent: delta\ndata: {"text":"Olá"}\n\n'),
            );
            timer = setInterval(
              () => controller.enqueue(encoder.encode(": heartbeat\n\n")),
              25,
            );
          },
          cancel,
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        },
      );
    })
    .listen({ hostname: "127.0.0.1", port: 0 });
  const controller = new AbortController();
  try {
    const response = await fetch(
      `http://127.0.0.1:${app.server?.port}/stream`,
      { signal: controller.signal },
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain(
      'data: {"text":"Olá"}',
    );
    controller.abort();
    const deadline = Date.now() + 2000;
    while (!cancelled && Date.now() < deadline) await Bun.sleep(10);
    expect(cancelled).toBe(true);
  } finally {
    cancel();
    controller.abort();
    await app.stop();
  }
});
test("Bun/Elysia exchanges validated bidirectional WebSocket messages", async () => {
  const app = new Elysia()
    .ws("/channel", {
      body: z.object({ text: z.string().max(100) }).strict(),
      message(socket, value) {
        socket.send(value.text);
      },
    })
    .listen({ hostname: "127.0.0.1", port: 0 });
  const socket = new WebSocket(`ws://127.0.0.1:${app.server?.port}/channel`);
  try {
    const received = await new Promise<string>((resolve, reject) => {
      socket.onopen = () =>
        socket.send(JSON.stringify({ text: "áudio sintético" }));
      socket.onmessage = (event) => resolve(String(event.data));
      socket.onerror = () => reject(Error("Test socket failed"));
    });
    expect(received).toBe("áudio sintético");
  } finally {
    socket.close();
    await app.stop();
  }
});
