import type { PanelState } from "./state.js";
import type { PanelSession } from "./data.js";
export function home(s: PanelState) {
  const { icon, esc, button, agenda, date, selectedMode, sessions } = s;
  const meetings = agenda
    .filter((a) => new Date(a.date).getTime() > Date.now())
    .sort((a, b) => a.date.localeCompare(b.date));
  return `<main class="dashboard-home"><section class="dashboard-overview"><div class="dashboard-container">${!s.releaseDismissed ? '<button class="release-badge" data-page="changelog">Novidades do Orvunia <span>↗</span></button>' : ""}<div class="overview-heading"><div class="overview-tools"><h1>Orvunia</h1><button class="round-outline" data-action="refresh" title="Atualizar">${icon("refresh", 16)}</button><button class="capture-state round-outline" data-setting="protected" title="Proteção de captura do Windows">${icon(s.desktop.settings.protected ? "eye-off" : "eye", 16)}<span>${s.desktop.settings.protected ? "Protegido" : "Detectável"}</span><span class="mini-switch ${s.desktop.settings.protected ? "on" : ""}"></span></button></div><div class="start-tools"><select class="mode-selector start-mode-caption" data-selected-mode aria-label="Modo da próxima sessão">${s.modes.map((m) => `<option value="${esc(m.id)}" data-i18n-skip ${selectedMode === m.id ? "selected" : ""}>${esc(s.modeName(m.id))}</option>`).join("")}</select><button class="start-button" data-action="quick-start">${icon("orbit", 21)}<span>Iniciar Orvunia</span></button></div></div>${
    s.renderCalendarUpcoming?.() ||
    (meetings.length
      ? `<div class="upcoming-meetings"><article class="next-meeting"><small>${date(meetings[0]!.date)}</small><div class="flex"><h2 data-i18n-skip>${esc(meetings[0]!.title)}</h2><button class="meeting-join" data-start="${meetings[0]!.mode}">Iniciar ${icon("arrow", 13)}</button></div><p data-i18n-skip>${esc(s.modeName(meetings[0]!.mode))}</p></article><div class="later-meetings">${meetings
          .slice(1, 4)
          .map(
            (a) =>
              `<button data-start="${a.mode}" class="later-meeting"><strong data-i18n-skip>${esc(a.title)}</strong><small>${date(a.date)}</small></button>`,
          )
          .join("")}</div></div>`
      : `<p class="calendar-prompt"><button type="button" disabled aria-disabled="true" data-google-coming-soon>Google Calendar · <span>Em breve</span></button></p>`)
  }</div></section><section class="dashboard-history"><div class="dashboard-container" id="session-results">${history(s, sessions)}</div></section></main>`;
}
export function renderHistory(s: PanelState, list: PanelSession[]) {
  return history(s, list);
}
export function history(s: PanelState, list: PanelSession[]) {
  const { icon, esc, ib, date, time } = s;
  if (!list.length)
    return `<div class="first-session"><div class="empty-header"><div class="empty-symbol">${icon("screen", 20)}</div><h2>${s.search ? "Nenhuma sessão encontrada" : "Inicie sua primeira sessão"}</h2><p>${s.search ? "Tente outro termo da conversa, da transcrição ou do título." : "Receba ajuda de IA durante a conversa e encontre suas notas e transcrições depois."}</p></div><button class="btn neutral-primary" data-action="quick-start">Iniciar Orvunia</button></div>`;
  const groups = new Map<string, PanelSession[]>();
  for (const session of list) {
    const d = new Date(session.date),
      today = new Date(),
      yesterday = new Date(Date.now() - 86400000);
    const label =
      d.toDateString() === today.toDateString()
        ? "Hoje"
        : d.toDateString() === yesterday.toDateString()
          ? "Ontem"
          : d.toLocaleDateString(s.uiLocale || "pt-BR", {
              month: "long",
              year: "numeric",
            });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(session);
  }
  return (
    [...groups]
      .map(
        ([label, items]) =>
          `<section class="history-group"><h2>${label}</h2><div>${items.map((session) => `<article class="meeting-row ${s.historyMenuId === session.id ? "menu-active" : ""}" data-history-menu-root><button class="meeting-main" data-session="${session.id}"><strong data-i18n-skip>${esc(session.title)}</strong><span class="meeting-row-meta">${session.state !== "ended" ? '<span class="session-live">Em andamento</span>' : ""}<span class="meeting-duration">${time(session.elapsed)}</span></span></button><button class="icon-btn history-menu-trigger" data-action="history-menu:${session.id}" aria-label="Opções da sessão ${esc(session.title)}" aria-haspopup="menu" aria-expanded="${s.historyMenuId === session.id}">${icon("dots", 17)}</button>${s.historyMenuId === session.id ? `<div class="history-row-menu ${s.historyMenuAbove ? "above" : ""}" role="menu"><button data-action="delete:${session.id}" role="menuitem">${icon("trash", 16)}Excluir</button></div>` : ""}</article>`).join("")}</div></section>`,
      )
      .join("") +
    (s.sessionIndexBefore
      ? s.button("Mostrar sessões anteriores", "session-index-older")
      : "")
  );
}
