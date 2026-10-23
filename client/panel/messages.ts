import { reportAction } from "../reporting/action.js";
import type { PanelState } from "./state.js";
import type { PanelResponse } from "./data.js";
export function sessionMessage(
  s: PanelState,
  response: PanelResponse,
  showModel = false,
) {
  const label = response.question
    ? ""
    : s.actionTitle(response.action, response.mode) || response.action;
  return `${response.question ? `<div class="session-user-message" data-message-role="user"><div class="detail-user-question" data-i18n-skip>${s.esc(response.question)}</div></div>` : ""}<section class="session-assistant-message" data-message-role="assistant"><p class="session-assistant-label">${s.icon("spark", 14)}<span>Orvunia</span>${label ? `<small>${s.esc(label)}</small>` : ""}</p><div class="markdown" data-i18n-skip>${s.markdown(response.text)}</div><div class="detail-answer-actions">${s.ib("copy", `copy:${response.id}`, "Copiar resposta")}${reportAction(response.id, s.uiLocale)}${response.mode === "technical" ? s.codingResponseActions?.(response) || "" : ""}${showModel && response.model ? `<small class="session-response-model" data-i18n-skip>${s.esc(response.model)}</small>` : ""}</div></section>`;
}
export function sessionPendingMessage(s: PanelState) {
  const phase =
    s.translate?.(s.answerPhase || "Preparando resposta…") ||
    s.answerPhase ||
    "Preparando resposta…";
  return `<section class="session-assistant-message" data-message-role="assistant"><p class="session-assistant-label">${s.icon("spark", 14)}<span>Orvunia</span><small class="coding-stream-status">${s.esc(phase)}</small></p><div class="markdown" id="live-answer" data-i18n-skip>${s.liveText ? s.markdown(s.liveText) : `<span class="session-answer-pending" data-answer-pending="${s.esc(s.current?.id || "session")}" role="status" aria-label="${s.esc(phase)}"></span>`}</div></section>`;
}
