export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timeZone: string;
  location: string;
  url: string;
  joinUrl: string;
};
export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
export type CalendarRecord = {
  workspaceId: string;
  revision: number;
  epoch: number;
  tokenVersion: number;
  tokens: string | null;
  events: CalendarEvent[];
  syncedAt: string | null;
  error: CalendarErrorCode | null;
  reconnect: boolean;
  truncated: boolean;
  authorization: { hash: string; verifier: string; expiresAt: number } | null;
  refresh: { id: string; expiresAt: number } | null;
  sync: { id: string; expiresAt: number } | null;
};
export type CalendarErrorCode =
  | "calendar_configuration"
  | "calendar_state"
  | "calendar_cancelled"
  | "calendar_connection"
  | "calendar_tokens"
  | "calendar_unavailable"
  | "calendar_denied"
  | "calendar_conflict";
export class CalendarError extends Error {
  constructor(
    readonly code: CalendarErrorCode,
    readonly status = 409,
    readonly reconnect = false,
  ) {
    super(code);
  }
}
export const calendarScope =
  "https://www.googleapis.com/auth/calendar.events.readonly";
export const emptyCalendar = (workspaceId: string): CalendarRecord => ({
  workspaceId,
  revision: 0,
  epoch: 0,
  tokenVersion: 0,
  tokens: null,
  events: [],
  syncedAt: null,
  error: null,
  reconnect: false,
  truncated: false,
  authorization: null,
  refresh: null,
  sync: null,
});
