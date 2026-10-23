import { expect, test } from "bun:test";
import { socketUpstream } from "../../packages/realtime/socket.ts";
import { waitUntil } from "../support/live-provider.ts";
test("upstream transport authenticates only to the configured server and never follows redirects with credentials", async () => {
  let redirected = 0,
    credential = "";
  const target = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      redirected++;
      return new Response();
    },
  });
  const redirect = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      credential = request.headers.get("authorization") ?? "";
      return new Response(null, {
        status: 302,
        headers: { location: `ws://127.0.0.1:${target.port}/capture` },
      });
    },
  });
  const upstream = socketUpstream(new URL(`ws://127.0.0.1:${redirect.port}`), {
    Authorization: "Bearer synthetic-private",
  });
  let ended = false,
    opened = false;
  upstream.ended(() => {
    ended = true;
  });
  upstream.opened(() => {
    opened = true;
  });
  try {
    await waitUntil(() => ended);
    expect(credential).toBe("Bearer synthetic-private");
    expect(redirected).toBe(0);
    expect(opened).toBe(false);
  } finally {
    upstream.close();
    await redirect.stop(true);
    await target.stop(true);
  }
});
test("upstream transport rejects oversized frames before exposing a message to the channel", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, runtime) {
      if (runtime.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      open(socket) {
        socket.send("x".repeat(1024 * 1024 + 1));
      },
      message() {},
    },
  });
  const upstream = socketUpstream(new URL(`ws://127.0.0.1:${server.port}`), {});
  let ended = false,
    received = false;
  upstream.ended(() => {
    ended = true;
  });
  upstream.message(() => {
    received = true;
  });
  try {
    await waitUntil(() => ended);
    expect(received).toBe(false);
  } finally {
    upstream.close();
    await server.stop(true);
  }
});
test("upstream transport opens, streams and closes a real socket under Bun", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, runtime) {
      if (runtime.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      message(socket, value) {
        socket.send(value);
      },
    },
  });
  const upstream = socketUpstream(new URL(`ws://127.0.0.1:${server.port}`), {});
  const messages: unknown[] = [];
  upstream.ended(() => {});
  upstream.opened(() => upstream.send("synthetic-event"));
  upstream.message((value) => messages.push(value));
  try {
    await waitUntil(() => messages.length === 1);
    expect(messages).toEqual(["synthetic-event"]);
  } finally {
    upstream.close();
    await server.stop(true);
  }
});
