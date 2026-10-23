import type { AnswerContext } from "./contracts.js";
import { assertAnswerActive } from "./contracts.js";
import type { AnswerOptions, AnswerRequest } from "./domain.js";
import type { CodingState } from "../coding/domain.js";
export async function prepareAnswer(
  context: AnswerContext,
  request: AnswerRequest,
  workspace: CodingState,
  sessionState: string,
  options: AnswerOptions,
  signal: AbortSignal,
) {
  assertAnswerActive(context, request, signal);
  if (request.prepared) return;
  const { state, audio, coding } = context;
  const phase = (text: string) => {
    state.answerPhase = text;
    context.render();
  };
  if (request.needsAudioFlush && !request.audioFlushed) {
    phase("Transcrevendo…");
    await audio.flush({ signal, timeoutMs: 10000 });
    assertAnswerActive(context, request, signal);
    request.audioFlushed = true;
    if (state.current?.id === request.sessionId) await context.sync();
    assertAnswerActive(context, request, signal);
  }
  if (request.autoCapturePending) {
    phase("Capturando tela…");
    if (!state.source) throw Error("Escolha a fonte da captura novamente.");
    await context.capture(state.source.id);
    assertAnswerActive(context, request, signal);
    request.autoCapturePending = false;
  }
  request.pendingIds ??=
    sessionState === "active" ? workspace.captures.map((item) => item.id) : [];
  if (request.pendingIds.length && sessionState === "active") {
    phase("Anexando capturas…");
    const uploaded = await coding.flush(
      request.sessionId,
      (blob, name, uploadKey) => {
        assertAnswerActive(context, request, signal);
        return context.upload(blob, name, request.sessionId, signal, uploadKey);
      },
      ({ completed, total }) => {
        assertAnswerActive(context, request, signal);
        state.answerPhase = `Anexando capturas: ${completed + 1}/${total}`;
        context.progress(state.answerPhase, request.sessionId);
      },
      request.pendingIds,
    );
    assertAnswerActive(context, request, signal);
    request.input.captureIds = uploaded.map((item) => item.id);
  } else if (
    request.input.mode !== "technical" &&
    options.captureIds === undefined
  ) {
    const snapshot =
      state.current?.id === request.sessionId
        ? state.current
        : await context.session(request.sessionId);
    assertAnswerActive(context, request, signal);
    request.input.captureIds = snapshot.captures
      .slice(-3)
      .reverse()
      .map((item) => item.id);
  }
  assertAnswerActive(context, request, signal);
  request.captureIds = [...request.input.captureIds];
  request.input = {
    ...request.input,
    captureIds: [...request.input.captureIds],
  };
  request.prepared = true;
  coding.consume(request.sessionId, request.pendingIds);
}
