import type { CalendarState, CalendarEvent } from "./contracts";
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("A agenda retornou um estado inválido.");
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 10000) {
  if (typeof value !== "string" || value.length > maximum)
    throw Error("A agenda retornou um estado inválido.");
  return value;
}
export function safeCalendarUrl(value: unknown, google = false) {
  const url = new URL(text(value));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (google && url.hostname !== "accounts.google.com")
  )
    throw Error("O endereço da agenda é inválido.");
  return url.href;
}
function event(value: unknown): CalendarEvent {
  const item = record(value);
  if (typeof item.allDay !== "boolean")
    throw Error("A agenda retornou um estado inválido.");
  const optional: Partial<CalendarEvent> = {};
  for (const key of ["timeZone", "location", "url", "joinUrl"] as const)
    if (item[key] !== undefined) optional[key] = text(item[key]);
  return {
    ...optional,
    id: text(item.id),
    title: text(item.title),
    start: text(item.start),
    end: text(item.end),
    allDay: item.allDay,
  };
}
export function calendarState(input: unknown): CalendarState {
  const value = record(input);
  if (
    typeof value.configured !== "boolean" ||
    typeof value.connected !== "boolean" ||
    !Array.isArray(value.events) ||
    value.events.length > 1000
  )
    throw Error("A agenda retornou um estado inválido.");
  const state: CalendarState = {
    configured: value.configured,
    connected: value.connected,
    events: value.events.map(event),
  };
  for (const key of [
    "error",
    "protection",
    "scope",
    "callbackURL",
    "configurationMessage",
  ] as const)
    if (value[key] !== undefined) state[key] = text(value[key]);
  for (const key of ["reconnectRequired", "truncated"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean")
      throw Error("A agenda retornou um estado inválido.");
    if (typeof value[key] === "boolean") state[key] = value[key];
  }
  if (value.syncedAt === null || typeof value.syncedAt === "string")
    state.syncedAt = value.syncedAt;
  return state;
}
export const calendarError = (value: unknown) =>
  value &&
  typeof value === "object" &&
  "message" in value &&
  typeof value.message === "string"
    ? value.message
    : "Não foi possível atualizar a agenda.";
