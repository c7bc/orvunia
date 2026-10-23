import type { AnswerContext } from "./contracts.js";
import type { AnswerOptions } from "./domain.js";
import { answerFailure } from "./domain.js";
import { createAnswerRequest, beginAnswer } from "./request.js";
import { executeAnswer } from "./execute.js";
export async function runAnswer(
  context: AnswerContext,
  action = "custom",
  questionOverride?: string,
  review = false,
  options: AnswerOptions = {},
) {
  const { state, coding, audio } = context;
  if (state.view === "control") {
    context.broadcast({ type: "command", action: "ask", key: action });
    return;
  }
  const retry = options.retry;
  const question =
    retry?.input.question ??
    questionOverride ??
    context.question() ??
    state.draft.trim();
  if (
    !review &&
    state.settings.ambientChat &&
    (!state.current || state.current.state === "ended") &&
    question
  ) {
    const generation = coding.generation;
    if (!state.ambientStarting) {
      const starting: Promise<void> = context
        .begin(state.selectedMode, context.modeName(state.selectedMode))
        .finally(() => {
          if (state.ambientStarting === starting) state.ambientStarting = null;
        });
      state.ambientStarting = starting;
    }
    await state.ambientStarting;
    if (coding.generation !== generation) return;
  }
  const session = state.current;
  if (!session) {
    context.toast("Inicie uma sessão no painel.");
    return;
  }
  review = retry?.review ?? review;
  if (retry && retry.sessionId !== session.id)
    throw Error("Reabra a sessão da solicitação antes de tentar novamente.");
  if (session.state !== "active" && !review) {
    context.toast("Retome a sessão para pedir uma resposta.");
    return;
  }
  if (state.busy) return;
  context.latest(session);
  let workspace;
  try {
    workspace = coding.reserve(session.id);
  } catch (error) {
    context.toast(answerFailure(error).message);
    return;
  }
  const technical = session.mode === "technical";
  const problem =
    options.problemOverride ?? (technical ? coding.problem(session.id) : "");
  if (
    !retry &&
    !question &&
    !problem &&
    !audio.running &&
    !session.transcripts.length &&
    !(technical
      ? workspace.captures.length || options.captureIds?.length
      : session.captures.length) &&
    !session.responses.length
  ) {
    context.toast(
      "Escreva uma pergunta, ative a escuta ou capture o enunciado.",
    );
    context.focusQuestion();
    return;
  }
  const request = createAnswerRequest(
    context,
    workspace,
    action,
    question,
    problem,
    review,
    options,
  );
  const signal = beginAnswer(context, request);
  await executeAnswer(
    context,
    request,
    workspace,
    session.state,
    options,
    signal,
  );
}
