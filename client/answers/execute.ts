import { createStreamRenderer } from "../coding/paint.js";
import { answerCurrent, assertAnswerActive } from "./contracts.js";
import type { AnswerContext } from "./contracts.js";
import { answerFailure, expiredContextMessage } from "./domain.js";
import type { AnswerOptions, AnswerRequest } from "./domain.js";
import type { CodingState } from "../coding/domain.js";
import { prepareAnswer } from "./prepare.js";
import { streamAnswer } from "./stream.js";
export async function executeAnswer(
  context: AnswerContext,
  request: AnswerRequest,
  workspace: CodingState,
  sessionState: string,
  options: AnswerOptions,
  signal: AbortSignal,
) {
  const { state, coding, tellMore } = context;
  const paint = createStreamRenderer((text) => {
    if (answerCurrent(context, request)) context.paint(text, request);
  });
  let partial = "",
    prefetchResponseId: string | null = null;
  try {
    if (tellMore.stats().active) await tellMore.cancelActive();
    assertAnswerActive(context, request, signal);
    await prepareAnswer(
      context,
      request,
      workspace,
      sessionState,
      options,
      signal,
    );
    const result = await streamAnswer(context, request, signal, (text) => {
      partial = text;
      if (answerCurrent(context, request)) {
        state.liveText = text;
        state.answerPhase = "Respondendo…";
        paint.push(text);
      }
    });
    paint.flush();
    assertAnswerActive(context, request, signal);
    if (
      request.input.mode === "technical" &&
      workspace.prefetchTellMore &&
      !["recap", "email"].includes(request.input.action)
    )
      prefetchResponseId = result.id;
    coding.rememberResponse(request.sessionId, result.id, result.captureIds);
    if (request.applyGenerated) {
      try {
        await context.applyGenerated(
          request.sessionId,
          result.text,
          request.applyGenerated,
        );
      } catch (error) {
        const failure = answerFailure(error);
        context.toast(failure.message);
        context.generatedFallback(
          request.sessionId,
          result.text,
          failure.message,
        );
      }
    }
    if (state.current?.id === request.sessionId) await context.sync();
    coding.attempt(request.sessionId, null);
    context.broadcast({ type: "session-changed", sessionId: request.sessionId });
  } catch (error) {
    if (
      request.workspaceGeneration !== coding.generation ||
      state.activeAnswerRequest !== request
    )
      return;
    const failure = answerFailure(error),
      cancelled = failure.name === "AbortError" || signal.aborted,
      expired = failure.status === 410;
    coding.attempt(request.sessionId, {
      text: partial,
      cancelled,
      expired,
      message: expired
        ? expiredContextMessage
        : cancelled
          ? "Você interrompeu a resposta. O trecho recebido foi preservado nesta janela."
          : failure.message,
      request,
      input: { ...request.input, captureIds: [...request.input.captureIds],
        ...(request.input.sourceTranscriptIds ? { sourceTranscriptIds: [...request.input.sourceTranscriptIds] } : {}) },
      review: request.review,
    });
    context.toast(
      expired
        ? expiredContextMessage
        : cancelled
          ? "Resposta interrompida. O trecho parcial foi preservado."
          : failure.message,
    );
  } finally {
    paint.cancel();
    if (state.activeAnswerRequest === request) {
      state.busy = false;
      state.controller = null;
      state.activeAnswerRequest = null;
      state.answerPhase = "";
      state.liveText = "";
      state.liveQuestion = "";
      context.render();
    }
    if (
      prefetchResponseId &&
      state.current?.id === request.sessionId &&
      request.workspaceGeneration === coding.generation &&
      workspace.prefetchTellMore
    )
      void tellMore
        .prepare(request.sessionId, prefetchResponseId)
        .catch(() => {});
  }
}
