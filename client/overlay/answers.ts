import { reportAction } from "../reporting/action.js";
import type { OverlayState } from "./state.js";
import { renderHistoryNavigation } from "../panel/paging.js";
import { responseSpeech, pendingSpeech, liveSpeechQuestionShown } from "./speech.js";
export function renderOverlayAnswers(context: OverlayState) {
  const {
    current,
    historyPager,
    busy,
    activeAnswerRequest,
    esc,
    icon,
    actionTitle,
    ib,
    codingResponseActions,
    liveQuestion,
    answerPhase,
    liveText,
    markdown,
    codingAttemptView,
  } = context;

  if (!current) return "";

  const page = current
      ? historyPager.page(current, "responses", { view: "overlay" })
      : null,
    responses = page?.items || [],
    navigation = renderHistoryNavigation(null, page, "responses", "overlay");
  const ownBusy = busy && activeAnswerRequest?.sessionId === current?.id;
  const speech = pendingSpeech(context, ownBusy ? "request" : "all"), shown = new Set<string>();
  return (
    navigation +
    `<div data-history-list="${esc(current.id)}|overlay" data-history-page="${esc(page?.key)}">` +
    responses
      .map(
        (r) => {
          const voice = responseSpeech(context, r, shown);
          return `${voice.markup}${r.question && !voice.questionShown ? `<div class="user-message">${esc(r.question)}</div>` : ""}<article class="response-card"><div class="response-meta">${icon("spark", 13)}Orvunia <small>· ${esc(actionTitle(r.action, r.mode))}</small><span class="grow"></span>${ib("copy", `copy:${r.id}`, "Copiar resposta")}${reportAction(r.id, context.uiLocale)}</div><div class="markdown" data-markdown="${esc(r.id)}"></div>${r.mode === "technical" ? codingResponseActions(r) : ""}</article>`;
        },
      )
      .join("") +
    `</div><div data-overlay-chat-speech="${esc(current.id)}" data-chat-position="${ownBusy ? "request" : "all"}">${speech.markup}</div>` +
    (ownBusy
      ? `${liveQuestion && !liveSpeechQuestionShown(context, speech) ? `<div class="user-message">${esc(liveQuestion)}</div>` : ""}<article class="response-card"><div class="response-meta">${icon("spark", 13)}Orvunia <small class="coding-stream-status" role="status">${esc(answerPhase || "Preparando resposta…")}</small></div><div class="markdown" id="live-answer">${liveText ? markdown(liveText) : '<div class="thinking"><i></i><i></i><i></i></div>'}</div></article>`
      : codingAttemptView()) +
    (ownBusy ? `<div data-overlay-chat-speech="${esc(current.id)}" data-chat-position="unanswered">${pendingSpeech(context, "unanswered").markup}</div>` : "")
  );
}
