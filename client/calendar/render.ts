import { currentLocale } from "@cadence/i18n";
import { googleMark } from "@cadence/icons";
import { googleIntegrationAvailable, googleCalendarComingSoon } from "../google/availability";
import type {
  CalendarEvent,
  CalendarState,
  UpcomingOptions,
} from "./contracts";
const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) => escapes[character] ?? character,
  );
function eventTime(event: CalendarEvent) {
  if (event.allDay) {
    const [year, month, day] = event.start.split("-");
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return `${date.toLocaleDateString(currentLocale(), { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })} · ${currentLocale().startsWith("en") ? "All day" : "Dia inteiro"}`;
  }
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) return event.start;
  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function renderCalendarSettings(state: Partial<CalendarState> = {}, available = googleIntegrationAvailable) {
  if (!available)
    return `<section class="calendar-settings"><h2>Agenda</h2>${googleCalendarComingSoon()}</section>`;
  return `<section class="calendar-settings"><h2>Agenda</h2><p class="calendar-subtitle">Veja suas próximas conversas e prepare o assistente antes de entrar.</p><div class="calendar-provider"><div class="calendar-google" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/></svg></div><div><h3>Google Calendar</h3><p>${state.connected ? (state.reconnectRequired ? "A conexão precisa ser autorizada novamente." : "Conectado · acesso de leitura à agenda principal") : "Conecte sua agenda para ver os próximos eventos."}</p></div><button class="btn ${state.connected && !state.reconnectRequired ? "" : "primary"}" data-calendar="${state.connected && !state.reconnectRequired ? "sync" : "connect"}" ${!state.configured ? "disabled" : ""}>${state.connected && !state.reconnectRequired ? "" : googleMark()}<span>${state.connected && !state.reconnectRequired ? "Atualizar" : "Conectar"}</span></button></div>${!state.configured ? `<div class="calendar-configuration"><p>${esc(state.configurationMessage || "Configure as credenciais OAuth do Google no servidor para habilitar a conexão.")}</p><p>Ative a Google Calendar API e permita o escopo de leitura de eventos no projeto Google.</p></div>` : ""}${state.error ? `<p class="calendar-error" role="alert">${esc(state.error)}</p>` : ""}${state.connected ? `<div class="calendar-status"><span>${state.syncedAt ? `Última sincronização: ${esc(new Date(state.syncedAt).toLocaleString(currentLocale()))}` : "A agenda ainda não foi sincronizada."}</span><button class="calendar-text-button" data-calendar="disconnect">Desconectar</button></div><p class="calendar-caption">A desconexão remove a autorização salva e os eventos deste aplicativo. Para revogar o acesso também no Google, use as conexões da sua Conta Google.</p><h3 class="calendar-upcoming-title">Próximos 30 dias</h3>${renderUpcomingEvents(state, { limit: 50 })}` : ""}${state.callbackURL ? `<details class="calendar-admin"><summary>Configuração OAuth</summary><p>URI de redirecionamento que deve estar cadastrada no Google:</p><code data-i18n-skip>${esc(state.callbackURL)}</code><p>O acesso à agenda é solicitado separadamente do login. Este aplicativo lê eventos e não altera sua agenda.</p></details>` : ""}</section>`;
}
export function renderUpcomingEvents(
  state: Partial<CalendarState> = {},
  { limit = 4, showHeading = false }: UpcomingOptions = {},
) {
  if (!state.connected) return "";
  const events = (state.events || []).slice(0, limit);
  return `${showHeading ? `<div class="calendar-section-heading"><h3>Próximos eventos</h3><button class="calendar-text-button" data-calendar="sync">Atualizar</button></div>` : ""}<div class="calendar-events">${events.length ? events.map((event, index) => `<article class="calendar-event"><div class="calendar-event-time" data-i18n-skip>${esc(eventTime(event))}</div><strong data-i18n-skip>${esc(event.title)}</strong>${event.location ? `<p data-i18n-skip>${esc(event.location)}</p>` : ""}<div class="calendar-event-actions"><button class="btn" data-calendar-start="${index}">Preparar conversa</button>${event.joinUrl ? `<button class="btn" data-calendar-open="join:${index}">Entrar na reunião ↗</button>` : event.url ? `<button class="calendar-text-button" data-calendar-open="event:${index}">Ver evento ↗</button>` : ""}</div></article>`).join("") : `<p class="calendar-empty">${state.syncedAt ? "Nenhum evento nos próximos 30 dias." : "Atualize a agenda para carregar seus próximos eventos."}</p>`}</div>${state.truncated ? `<p class="calendar-caption">Mostrando até 1.000 eventos. O Google informou que há mais resultados neste período.</p>` : ""}`;
}
