import type { AnswerContext } from "./contracts.js";
import type { AnswerOptions, AnswerRequest } from "./domain.js";
import type { CodingState } from "../coding/domain.js";
export function createAnswerRequest(
  context: AnswerContext,
  workspace: CodingState,
  action: string,
  question: string,
  problem: string,
  review: boolean,
  options: AnswerOptions,
): AnswerRequest {
  const { state, coding, audio } = context;
  const retry = options.retry;
  const input = retry
    ? { ...retry.input, captureIds: [...retry.input.captureIds],
        ...(retry.input.sourceTranscriptIds ? { sourceTranscriptIds: [...retry.input.sourceTranscriptIds] } : {}) }
    : {
        requestId: context.identify(),
        mode: state.current!.mode,
        action,
        question,
        ...(options.sourceTranscriptIds ? { sourceTranscriptIds: [...options.sourceTranscriptIds] } : {}),
        problem,
        codeLanguage:
          options.codeLanguage || workspace.language || state.codeLanguage,
        captureIds: [...(options.captureIds || [])],
      };
  return retry
    ? { ...retry, input, pendingIds: retry.pendingIds && [...retry.pendingIds],
        ...(input.sourceTranscriptIds ? { sourceTranscriptIds: [...input.sourceTranscriptIds] } : {}) }
    : {
        sessionId: state.current!.id,
        input,
        review,
        captureIds: [],
        pendingIds: null,
        prepared: false,
        autoCapturePending: Boolean(
          state.settings.autoScreen && state.native && state.source,
        ),
        applyGenerated: options.applyGenerated || null,
        workspaceGeneration: coding.generation,
        needsAudioFlush: audio.running,
        audioFlushed: false,
        ...(input.sourceTranscriptIds ? { sourceTranscriptIds: [...input.sourceTranscriptIds] } : {}),
      };
}
export function beginAnswer(context: AnswerContext, request: AnswerRequest) {
  const { state, coding } = context;
  state.chatCollapsed = false;
  state.busy = true;
  state.controller = new AbortController();
  state.activeAnswerRequest = request;
  state.answerPhase = "Preparando contexto…";
  state.liveText = "";
  state.liveQuestion = request.input.question;
  state.draft = "";
  state.tab = "answers";
  coding.attempt(request.sessionId, null);
  context.render();
  return state.controller.signal;
}
