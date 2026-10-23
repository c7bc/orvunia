import { expect, test } from "bun:test";
import { applicationLifetime } from "../../packages/runtime/application-lifetime.ts";

function gate() {
  let resolve = () => {};
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  return { pending, resolve };
}

test("all services receive cancellation before waiting and resources remain open until every service settles", async () => {
  const lifetime = applicationLifetime(),
    waiting = gate(),
    events: string[] = [];
  lifetime.resource(() => {
    events.push("database");
  });
  lifetime.resource(() => {
    events.push("redis");
  });
  lifetime.resource(() => {
    events.push("objects");
  });
  lifetime.activity(() => {
    events.push("billing");
    throw Error("synthetic");
  });
  lifetime.activity(async () => {
    events.push("audio");
    await waiting.pending;
    events.push("audio-done");
  });
  lifetime.activity(() => {
    events.push("generation");
  });
  const first = lifetime.close(),
    repeated = lifetime.close();
  expect(first).toBe(repeated);
  const outcome = first.catch((error: unknown) => error);
  await Bun.sleep(0);
  expect(events).toEqual(["billing", "audio", "generation"]);
  waiting.resolve();
  expect(await outcome).toBeInstanceOf(AggregateError);
  expect(events).toEqual([
    "billing",
    "audio",
    "generation",
    "audio-done",
    "objects",
    "redis",
    "database",
  ]);
  expect(lifetime.close()).toBe(first);
});

test("an explicit failed drain is remembered and a later close still releases every resource exactly once", async () => {
  const lifetime = applicationLifetime(),
    closed: string[] = [];
  let attempts = 0;
  lifetime.resource(() => {
    closed.push("database");
  });
  lifetime.resource(() => {
    closed.push("objects");
    throw Error("objects");
  });
  lifetime.activity(() => {
    attempts++;
    throw Error("operation");
  });
  const first = lifetime.drain();
  await expect(first).rejects.toThrow("Application drain failed");
  expect(lifetime.drain()).toBe(first);
  await expect(lifetime.close()).rejects.toThrow("Application cleanup failed");
  expect(closed).toEqual(["objects", "database"]);
  expect(attempts).toBe(1);
  expect(() => lifetime.resource(() => {})).toThrow("closing");
  expect(() => lifetime.activity(() => {})).toThrow("closing");
});

test("successful drain leaves infrastructure usable until close and cannot run again", async () => {
  const lifetime = applicationLifetime(),
    events: string[] = [];
  lifetime.resource(() => {
    events.push("database");
  });
  lifetime.activity(() => {
    events.push("streams");
  });
  await Promise.all([lifetime.drain(), lifetime.drain()]);
  expect(events).toEqual(["streams"]);
  await Promise.all([lifetime.close(), lifetime.close()]);
  expect(events).toEqual(["streams", "database"]);
});
