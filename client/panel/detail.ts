import type { PanelState } from "./state.js";

import { home } from "./home.js";
import { sessionResponsePage } from "./paging.js";
import { sessionMessage } from "./messages.js";
import { sessionPendingMessage } from "./messages.js";
import { renderSessionUsage } from "./usage.js";
import { renderSessionTranscript } from "./transcript.js";
export function detail(s: PanelState) {
  const session = s.current;
  if (!session) return home(s);
  const summary =
      session.latestSummary ||
      session.responses.filter((r) => r.action === "recap").at(-1),
    conversationPage = sessionResponsePage(
      s,
      session.responses.filter((r) => r.action !== "recap"),
    ),
    conversations = conversationPage.responses;
  const detailBusy =
    s.busy && (!s.answerSessionId || s.answerSessionId === session.id);
  const codingAttempt =
    s.detailTab === "notes" && session.mode === "technical" && !detailBusy
      ? s.codingAttemptView?.() || ""
      : "";
  const content =
    s.detailTab === "transcripts"
      ? renderSessionTranscript(s, session)
      : s.detailTab === "usage"
        ? renderSessionUsage(s, session)
        : "";
  const hasActiveSession =
    s.hasActiveSession ?? ["active", "paused"].includes(session.state);
  const notes =
    s.detailTab === "notes"
      ? `<section class="session-personal-notes"><textarea data-session-notes data-session="${s.esc(session.id)}" maxlength="100000" rows="6" aria-label="Notas pessoais" placeholder="Escreva suas notas aqui…">${s.esc(session.notes ?? summary?.text ?? "")}</textarea></section>`
      : "";
  return `<div class="session-detail session-detail-centered" data-session-detail="${s.esc(session.id)}"><div class="session-detail-scroll"><div class="session-document"><div class="detail-header"><div><div class="detail-date" data-i18n-skip>${(s.detailDate || s.date)(session.date)}</div><h1><input class="detail-title-edit" data-session-title data-session="${s.esc(session.id)}" aria-label="Título da sessão" maxlength="200" spellcheck="false" value="${s.esc(session.title)}"></h1></div><div class="detail-document-export">${s.ib("download", `export:${session.id}`, "Exportar sessão")}</div></div><div class="detail-toolbar"><nav class="detail-tabs" data-component="segmented-tabs" data-session-tabs="${s.esc(session.id)}" role="tablist" aria-label="Detalhes da sessão">${[
    ["notes", "Resumo"],
    ["transcripts", "Transcrição"],
    ["usage", "Uso"],
  ]
    .map(
      ([key, title]) =>
        `<button class="${s.detailTab === key ? "selected" : ""}" data-detail-tab="${key}" id="session-tab-${s.esc(session.id)}-${key}" role="tab" aria-selected="${s.detailTab === key}" aria-controls="session-content-${s.esc(session.id)}" tabindex="${s.detailTab === key ? "0" : "-1"}">${s.detailTab === key ? '<span class="session-tab-pill" aria-hidden="true"></span>' : ""}<span class="session-tab-label">${title}</span></button>`,
    )
    .join(
      "",
    )}</nav>${s.detailTab === "notes" ? `<span data-note-status data-session="${s.esc(session.id)}" role="status" aria-live="polite" class="session-note-status"></span>` : ""}${s.detailTab === "notes" ? `<div class="summary-actions">${s.button("Gerar novamente", "review-recap", "", "refresh")}${s.button("Copiar resumo", "copy-summary", "", "copy")}${session.transcripts.length || session.responses.length ? `<details class="summary-more"><summary aria-label="Mais ações da reunião">${s.icon("dots", 16)}</summary><div role="menu"><button role="menuitem" data-action="followup-email">${s.icon("file", 15)}Email de acompanhamento</button><button role="menuitem" data-action="export:${session.id}">${s.icon("download", 15)}Exportar sessão</button></div></details>` : ""}</div>` : s.detailTab === "transcripts" && session.transcripts.length ? `<div class="summary-actions">${s.button("Copiar transcrição", "copy-transcript", "", "copy")}</div>` : ""}</div><section class="detail-notes-content" id="session-content-${s.esc(session.id)}" role="tabpanel" aria-labelledby="session-tab-${s.esc(session.id)}-${s.detailTab}" tabindex="0">${content}${notes}</section>${!s.reviewChatOpen && s.detailTab === "notes" && (conversations.length || conversationPage.load || detailBusy || codingAttempt) ? `<section class="detail-chat-log"><h2>Conversa sobre a reunião</h2>${conversationPage.load}<div data-history-list="${s.esc(session.id)}|panel-conversation" data-history-page="${s.esc(conversationPage.page?.key || "")}">${conversations.map((r) => `<article>${sessionMessage(s, r)}</article>`).join("")}</div>${detailBusy ? `<article aria-live="polite">${sessionPendingMessage(s)}</article>` : ""}${codingAttempt}</section>` : ""}</div></div>${hasActiveSession ? "" : `<div class="session-detail-bottom"><div class="meeting-bottom-bar" data-motion-footer="${s.esc(session.id)}"><button class="resume-meeting" data-action="resume-detail">${s.icon("play-solid", 13)}Retomar sessão</button><div class="detail-chat-composer"><textarea id="detail-question" maxlength="6000" placeholder="Pergunte sobre esta reunião…" rows="1" aria-label="Pergunta sobre a reunião"></textarea><button data-action="review-ask" aria-label="Enviar pergunta" disabled>${s.icon("arrow-up-right", 16)}</button></div></div></div>`}</div>`;
}
