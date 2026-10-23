import { expect, test } from "bun:test";
import { createNativeShutdown } from "../../packages/desktop/shutdown.ts";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("repeated quits share one drain and backend stop without bypassing either barrier", async () => {
  const drain = deferred(),
    stopped = deferred(),
    events: string[] = [];
  const shutdown = createNativeShutdown({
    async drain() {
      events.push("drain");
      await drain.promise;
    },
    async stop() {
      events.push("stop");
      await stopped.promise;
    },
    quit() {
      events.push("quit");
    },
    failed() {
      events.push("failed");
    },
    cancel() {
      events.push("cancel");
    },
  });
  const first = shutdown.request();
  expect(shutdown.request()).toBe(first);
  expect(shutdown.ready()).toBe(false);
  await Promise.resolve();
  expect(events).toEqual(["drain"]);
  drain.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(events).toEqual(["drain", "stop"]);
  expect(shutdown.request()).toBe(first);
  expect(shutdown.ready()).toBe(false);
  stopped.resolve();
  await first;
  expect(events).toEqual(["drain", "stop", "quit"]);
  expect(shutdown.ready()).toBe(true);
  expect(shutdown.running()).toBe(false);
  await shutdown.request();
  expect(events.length).toBe(3);
});
test("failed saves keep the backend running and permit a complete retry", async () => {
  let failure = true;
  const events: string[] = [];
  const shutdown = createNativeShutdown({
    async drain() {
      if (failure) throw Error("unsaved");
    },
    async stop() {
      events.push("stop");
    },
    quit() {
      events.push("quit");
    },
    failed() {
      events.push("failed");
    },
    cancel() {
      events.push("cancel");
    },
  });
  await shutdown.request();
  expect(events).toEqual(["cancel", "failed"]);
  expect(shutdown.ready()).toBe(false);
  failure = false;
  await shutdown.request();
  expect(events).toEqual(["cancel", "failed", "stop", "quit"]);
});
test("unconfirmed backend shutdown cannot be treated as a completed quit", async () => {
  let quits = 0,
    cancellations = 0;
  const shutdown = createNativeShutdown({
    async drain() {},
    async stop() {
      throw Error("child alive");
    },
    quit() {
      quits++;
    },
    failed() {},
    cancel() {
      cancellations++;
    },
  });
  await shutdown.request();
  await shutdown.request();
  expect(shutdown.ready()).toBe(false);
  expect(quits).toBe(0);
  expect(cancellations).toBe(2);
});
