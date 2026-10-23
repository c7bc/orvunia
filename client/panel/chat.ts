import type { PanelState } from "./state.js";

import { sessionResponsePage } from "./paging.js";
import { sessionMessage } from "./messages.js";
import { sessionPendingMessage } from "./messages.js";
export function renderSessionChat(s: PanelState) {
  const session = s.current;
  if (!session) return "";
  const page = sessionResponsePage(
      s,
      session.responses.filter((response) => response.action !== "recap"),
      session,
      "review-chat",
    ),
    messages = page.responses;
  const busy =
    s.busy && (!s.answerSessionId || s.answerSessionId === session.id);
  const attempt =
    !busy && session.mode === "technical" ? s.codingAttemptView?.() || "" : "";
  return `<div class="session-review-thread" data-session-chat="${s.esc(session.id)}"><div class="session-review-mask"><section class="session-review-messages" aria-label="Conversa sobre a reunião">${page.load}<div data-history-list="${s.esc(session.id)}|review-chat" data-history-page="${s.esc(page.page?.key || "")}">${messages.map((response) => `<article data-session-response="${s.esc(response.id)}">${sessionMessage(s, response)}</article>`).join("")}</div>${busy ? `<article aria-live="polite">${sessionPendingMessage(s)}</article>` : ""}${attempt}${!messages.length && !busy && !attempt ? '<p class="notes-empty">Nenhuma mensagem nesta conversa.</p>' : ""}</section></div><div class="session-review-composer-wrap"><div class="session-review-composer"><textarea id="session-chat-question" data-session="${s.esc(session.id)}" rows="1" maxlength="6000" aria-label="Pergunta sobre a reunião" placeholder="Pergunte sobre esta reunião…">${s.esc(s.reviewChatDraft || "")}</textarea>${busy ? `<button data-motion-chat-control="${s.esc(session.id)}:cancel" data-action="cancel-answer" aria-label="Interromper resposta">${s.icon("stop-solid", 12)}</button>` : `<button data-motion-chat-control="${s.esc(session.id)}:send" data-action="session-chat-send" aria-label="Enviar pergunta" ${String(s.reviewChatDraft || "").trim() ? "" : "disabled"}>${s.icon("arrow-up-right", 18)}</button>`}</div></div></div>`;
}
