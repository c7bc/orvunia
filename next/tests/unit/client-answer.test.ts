import { expect, test } from "bun:test";
import { clientAnswer } from "../support/client-answer.ts";
import { runAnswer } from "../../../client/answers/index.ts";

test("clearing the workspace while audio is draining prevents a late provider request and cannot recreate its drafts", async () => {
  const { context, state, coding, sent } = clientAnswer();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  context.audio = { running: true, flush: async () => gate };
  const sessionId = state.current!.id;
  const running = runAnswer(context);
  expect(state.answerPhase).toBe("Transcrevendo…");
  coding.dispose();
  release();
  await running;
  expect(sent).toEqual([]);
  expect(coding.get(sessionId).attempt).toBeNull();
  expect(coding.stats().sessions).toBe(0);
  expect(state.busy).toBe(false);
});

test("an old answer completion cannot clear the state of a newer request", async () => {
  const { context, state, coding } = clientAnswer();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  context.fetch = async () => {
    await gate;
    return new Response(
      'event: delta\ndata: {"text":"Old answer"}\n\nevent: done\ndata: {"id":"old"}\n\n',
    );
  };
  const running = runAnswer(context);
  const original = state.activeAnswerRequest!;
  const replacement = {
    ...original,
    input: { ...original.input, requestId: crypto.randomUUID() },
  };
  state.activeAnswerRequest = replacement;
  state.liveText = "New request in progress";
  release();
  await running;
  expect(state.activeAnswerRequest).toBe(replacement);
  expect(state.busy).toBe(true);
  expect(state.liveText).toBe("New request in progress");
  expect(coding.get(original.sessionId).attempt).toBeNull();
  coding.dispose();
});

test("an invalid completion preserves the received partial text without publishing corrupt response references", async () => {
  const { context, state, coding, notices } = clientAnswer();
  context.fetch = async () =>
    new Response(
      'event: delta\ndata: {"text":"Preserved partial"}\n\nevent: done\ndata: {"id":"invalid","captureIds":[12]}\n\n',
    );
  await runAnswer(context);
  const attempt = coding.get(state.current!.id).attempt as {
    text: string;
    request: { prepared: boolean };
  };
  expect(attempt.text).toBe("Preserved partial");
  expect(attempt.request.prepared).toBe(true);
  expect(coding.responseCaptureIds(state.current!.id, "invalid")).toEqual([]);
  expect(notices).toContain("A resposta enviada pelo servidor é inválida.");
  coding.dispose();
});
