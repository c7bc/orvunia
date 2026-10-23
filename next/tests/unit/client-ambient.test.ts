import { expect, test } from "bun:test";
import { clientAnswer } from "../support/client-answer.ts";
import { runAnswer } from "../../../client/answers/index.ts";
test("a late ambient-session start cannot send a question in a new workspace or erase its pending start", async () => {
  const { context, state, coding, sent } = clientAnswer();
  const original = state.current!;
  state.current = null;
  state.settings.ambientChat = true;
  let release!: () => void;
  context.begin = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const answering = runAnswer(context);
  coding.dispose();
  state.current = { ...original, id: crypto.randomUUID() };
  const replacement = new Promise<void>(() => {});
  state.ambientStarting = replacement;
  release();
  await answering;
  expect(sent).toEqual([]);
  expect(state.ambientStarting).toBe(replacement);
  expect(state.busy).toBe(false);
  expect(state.current.id).not.toBe(original.id);
});
