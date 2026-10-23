import type { AgendaContext } from "./compatibility-types.js";
export function renderAgenda(context: AgendaContext, now: number) {
  const { agenda, button, icon, date, modeName, iconButton, escape } = context;
  return `<div class="page-title"><div><h1>Próximas conversas</h1><p class="subtitle">Planeje uma sessão e receba um lembrete com o aplicativo aberto.</p></div>${button("Agendar", "schedule", "primary", "plus")}</div><div class="stack">${
    agenda
      .filter((a) => new Date(a.date).getTime() > now - 3600000)
      .map(
        (a) =>
          `<div class="document">${icon("calendar", 22)}<div class="grow"><h3>${escape(a.title)}</h3><p>${date(a.date)} · ${modeName(a.mode)}</p></div><button class="btn" data-start="${a.mode}">Abrir</button>${iconButton("trash", `agenda-delete:${a.id}`, "Excluir lembrete")}</div>`,
      )
      .join("") || '<div class="empty">Nenhuma conversa agendada.</div>'
  }</div><div class="notice">Esta agenda é local. Não se conecta automaticamente ao Google Calendar ou Outlook.</div>`;
}
