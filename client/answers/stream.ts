import { consumeAnswerStream } from "../coding/stream.js";
import type { AnswerContext } from "./contracts.js";
import type { AnswerRequest } from "./domain.js";
export async function streamAnswer(
  context: AnswerContext,
  request: AnswerRequest,
  signal: AbortSignal,
  delta: (text: string) => void,
) {
  signal.throwIfAborted();
  context.state.answerPhase = "Pensando…";
  context.render();
  const response = await context.fetch(
    `/api/sessions/${request.sessionId}/${request.review ? "review" : "answers"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cadence-Request": "1" },
      body: JSON.stringify(request.input),
      signal,
    },
  );
  if (!response.ok) {
    const body: unknown = await response.json();
    const detail =
      body && typeof body === "object" && "error" in body ? body.error : null;
    const message =
      detail &&
      typeof detail === "object" &&
      "message" in detail &&
      typeof detail.message === "string"
        ? detail.message
        : "Falha ao pedir resposta.";
    throw Object.assign(Error(message), { status: response.status });
  }
  const result = await consumeAnswerStream(response, {
    signal,
    onDelta: (_delta, text) => delta(text),
  });
  const done = result.done;
  if (
    (done.id !== undefined && typeof done.id !== "string") ||
    (done.captureIds !== undefined &&
      (!Array.isArray(done.captureIds) ||
        !done.captureIds.every((value) => typeof value === "string")))
  )
    throw Error("A resposta enviada pelo servidor é inválida.");
  return {
    id: (typeof done.id === "string" && done.id) || request.input.requestId,
    text: (typeof done.text === "string" && done.text) || result.text,
    captureIds: Array.isArray(done.captureIds)
      ? (done.captureIds as string[])
      : request.input.captureIds,
  };
}
