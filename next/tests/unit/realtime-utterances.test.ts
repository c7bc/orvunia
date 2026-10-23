import { expect, test } from "bun:test";
import { transcriptionTurns } from "../../packages/realtime/turns.ts";
import { RealtimeDrain } from "../../packages/realtime/drain.ts";

test("utterance IDs bind only to their acknowledged commit and survive out-of-order finals", async () => {
  const drain = new RealtimeDrain("openai"), saved: unknown[][] = [];
  let time = "00:01";
  const turns = transcriptionTurns(drain, () => time, async (...args) => { saved.push(args); });
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  drain.append(4800); drain.commit(); turns.commit(first);
  time = "00:02"; drain.append(4800); drain.commit(); turns.commit(second);
  expect(turns.utterance("a")).toBeUndefined();
  await turns.acknowledged("b", "a");
  expect(turns.utterance("b")).toBeUndefined();
  await turns.completed("b", "Second");
  expect(saved).toHaveLength(0);
  await turns.acknowledged("a", null);
  expect(turns.utterance("a")).toBe(first);
  expect(turns.utterance("b")).toBe(second);
  await turns.completed("a", "First");
  expect(saved).toEqual([["a", "First", "00:01", first], ["b", "Second", "00:02", second]]);
  expect(turns.utterance("a")).toBeUndefined();
  await turns.acknowledged("a", null); await turns.completed("a", "Duplicate");
  expect(saved).toHaveLength(2);
});

test("checkpoints retain one utterance ID while legacy commits and direct finals have no inferred ID", async () => {
  const drain = new RealtimeDrain("openai"), saved: unknown[][] = [];
  const turns = transcriptionTurns(drain, () => "00:01", async (...args) => { saved.push(args); });
  const id = crypto.randomUUID();
  for (const source of [id, id, undefined]) { drain.append(4800); drain.commit(); turns.commit(source); }
  await turns.acknowledged("a", null); await turns.acknowledged("b", "a"); await turns.acknowledged("c", "b");
  await turns.completed("a", "First part"); await turns.completed("b", "Second part"); await turns.completed("c", "Legacy");
  await turns.final("deepgram-direct", "Independent final");
  expect(saved.map(row => row[3])).toEqual([id, id, undefined, undefined]);
});
