import type { PanelState } from "./state.js";
import type { PanelSession } from "./data.js";
import { historyTotal } from "../history/view.js";
import { sessionResponsePage } from "./paging.js";
import { sessionMessage } from "./messages.js";
export function renderSessionUsage(s: PanelState, session: PanelSession) {
  const page = sessionResponsePage(
      s,
      session.responses.filter((response) => response.action !== "recap"),
      session,
      "panel-usage",
    ),
    messages = page.responses;
  const content = messages.length
    ? `<div class="session-usage-messages" data-history-list="${s.esc(session.id)}|panel-usage" data-history-page="${s.esc(page.page?.key || "")}">${messages.map((response) => `<article data-session-response="${s.esc(response.id)}">${sessionMessage(s, response, true)}</article>`).join("")}</div>`
    : '<p class="notes-empty">Nenhuma mensagem de uso ainda.</p>';
  return `${page.load}${content}${session.mode === "technical" && !(s.busy && (!s.answerSessionId || s.answerSessionId === session.id)) && s.current?.id === session.id ? s.codingAttemptView?.() || "" : ""}<details class="session-data"><summary>Dados da sessão</summary><div class="session-usage"><div><span>Duração da sessão</span><strong data-i18n-skip>${s.time(session.elapsed)}</strong></div><div><span>Respostas geradas</span><strong data-i18n-skip>${historyTotal(session, "responses")}</strong></div><div><span>Trechos transcritos</span><strong data-i18n-skip>${historyTotal(session, "transcripts")}</strong></div><div><span>Capturas de tela</span><strong data-i18n-skip>${historyTotal(session, "captures")}</strong></div></div><p class="settings-footnote">Contagens dos dados salvos nesta sessão. Consulte o custo no provedor configurado.</p></details>`;
}
/** Saved transcript plus explicitly supplied live signals; recording alone never
 * implies voice activity. Signals from another session are ignored. */
