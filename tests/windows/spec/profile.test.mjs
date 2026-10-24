import test from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { seedProfile } from "../reporting/profile.mjs";
test("offline seed uses and reopens the product-prepared storage, never a guessed legacy database path", async () => {
  const directory = resolve("owned-qa/backend-data/selected"), profile = resolve("owned-qa");
  const calls = [], workspaceId = "synthetic-workspace", connection = { close: () => calls.push("close") };
  const prepare = async options => {
    assert.equal(options.profile, profile); assert.equal(options.seed, workspaceId);
    assert.equal(options.quiesced, true); assert.ok(options.signal instanceof AbortSignal);
    calls.push("prepare"); return { directory, workspaceId };
  };
  const sessions = () => ({ create: async () => calls.push("create"), change: async () => calls.push("change"),
    counts: async () => { calls.push("counts"); return { responses: 1 }; } });
  const connect = path => { assert.equal(path, join(directory, "cadence-next.sqlite")); calls.push("connect"); return connection; };
  await seedProfile({ profile, workspaceId, selected: { sessionId: "synthetic", responseId: "answer", answer: "Synthetic QA only" },
    prepare, connect, sessions });
  assert.deepEqual(calls, ["prepare", "connect", "create", "change", "counts", "close", "prepare"]);
  await assert.rejects(seedProfile({ profile, workspaceId, prepare: async () => ({ directory, workspaceId: "other" }),
    connect: () => { throw Error("Must not seed a different owner"); }, sessions }));
});
