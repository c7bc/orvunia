import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  RealtimeDrain,
  realtimeFlushTimeout,
} from "../../packages/realtime/drain.ts";

test("empty flush acknowledges immediately; OpenAI finals are matched by committed item and contiguous turn watermark", () => {
  const drain = new RealtimeDrain("openai");
  assert.deepEqual(drain.flush("empty"), [{ type: "flushed", id: "empty" }]);
  drain.append(4800);
  drain.commit();
  drain.append(4800);
  drain.commit();
  drain.committed("item-a");
  drain.committed("item-b");
  assert.deepEqual(drain.flush("two"), []);
  drain.completed("item-b");
  assert.equal(drain.confirmedBytes, 0);
  assert.deepEqual(drain.poll(), []);
  drain.completed("item-a");
  assert.equal(drain.confirmedBytes, 9600);
  assert.deepEqual(drain.poll(), [{ type: "flushed", id: "two" }]);
  assert.equal(drain.committed("item-a"), false);
  assert.equal(drain.completed("item-a"), false);
});
test("a flush keeps its original byte watermark while later audio/commits remain pending", () => {
  const drain = new RealtimeDrain("openai");
  drain.append(4800);
  drain.commit();
  assert.deepEqual(drain.flush("first"), []);
  drain.append(4800);
  drain.commit();
  drain.committed("a");
  drain.committed("b");
  drain.completed("a");
  assert.deepEqual(drain.poll(), [{ type: "flushed", id: "first" }]);
  assert.deepEqual(drain.flush("second"), []);
  drain.completed("b");
  assert.deepEqual(drain.poll(), [{ type: "flushed", id: "second" }]);
  assert.deepEqual(drain.flush("first"), [{ type: "flushed", id: "first" }]);
});
test("unknown completions cannot clear pending commits and duplicate commit acknowledgements cannot bind another turn", () => {
  const drain = new RealtimeDrain("openai");
  drain.append(4800);
  drain.commit();
  drain.append(4800);
  drain.commit();
  assert.equal(drain.completed("uncommitted-item"), false);
  drain.committed("a");
  assert.equal(drain.committed("a"), false);
  drain.completed("a");
  assert.deepEqual(drain.flush("pending"), []);
  drain.committed("b");
  drain.completed("b");
  assert.deepEqual(drain.poll(), [{ type: "flushed", id: "pending" }]);
  assert.throws(() => drain.committed("unknown"), /unknown commit/);
});
test("Deepgram requires continuous confirmed final coverage; finalizing a later interval cannot acknowledge an earlier gap", () => {
  const drain = new RealtimeDrain("deepgram");
  drain.append(48000);
  drain.commit();
  assert.deepEqual(drain.flush("coverage"), []);
  drain.deepgramFinal(0.5, 0.5);
  assert.equal(drain.confirmedBytes, 0);
  assert.deepEqual(drain.poll(), []);
  drain.deepgramFinal(0, 0.25);
  assert.equal(drain.confirmedBytes, 12000);
  assert.deepEqual(drain.poll(), []);
  drain.deepgramFinal(0.25, 0.25);
  assert.equal(drain.confirmedBytes, 48000);
  assert.deepEqual(drain.poll(), [{ type: "flushed", id: "coverage" }]);
  assert.equal(drain.deepgramFinal(0, 100), false);
  assert.equal(drain.deepgramFinal(Number.NaN, 1), false);
});
test("timeout is explicit and preserves audio confirmation; a fresh flush can succeed after a late final", () => {
  let now = 0;
  const drain = new RealtimeDrain("deepgram", () => now);
  drain.append(2400);
  drain.commit();
  assert.deepEqual(drain.flush("short"), []);
  now = realtimeFlushTimeout - 1;
  assert.deepEqual(drain.poll(), []);
  now++;
  const failed = drain.poll();
  assert.equal(failed[0]!.type, "flush-error");
  assert.equal(failed[0]!.id, "short");
  assert.equal(drain.bytes, 2400);
  drain.deepgramFinal(0, 0.05);
  assert.deepEqual(drain.flush("later"), [{ type: "flushed", id: "later" }]);
  assert.equal(drain.flush("short")[0]!.type, "flush-error");
});
test("waiters, pending turn IDs, PCM and disjoint coverage are bounded and close removes channel state", () => {
  const drain = new RealtimeDrain("openai");
  drain.append(4800);
  drain.commit();
  for (let i = 0; i < 8; i++) assert.deepEqual(drain.flush("wait-" + i), []);
  assert.equal(drain.flush("ninth")[0]!.type, "flush-error");
  for (let i = 1; i < 256; i++) {
    drain.append(2);
    drain.commit();
  }
  drain.append(2);
  assert.throws(() => drain.commit(), /Too many pending/);
  assert.throws(() => drain.append(3), /Invalid PCM/);
  drain.close();
  assert.deepEqual(drain.poll(), []);
});
