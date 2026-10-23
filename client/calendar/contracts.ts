export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timeZone?: string;
  location?: string;
  url?: string;
  joinUrl?: string;
};
export type CalendarState = {
  configured: boolean;
  connected: boolean;
  events: CalendarEvent[];
  reconnectRequired?: boolean;
  syncedAt?: string | null;
  error?: string;
  protection?: string;
  scope?: string;
  callbackURL?: string;
  configurationMessage?: string;
  truncated?: boolean;
};
export type UpcomingOptions = { limit?: number; showHeading?: boolean };
export type CalendarApi = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export type CalendarOptions = {
  integrationAvailable?: boolean;
  api?: CalendarApi;
  toast?: (message: string) => void;
  onChange?: (state: CalendarState) => void | Promise<void>;
  onOpenURL?: (url: string) => void | Promise<void>;
  onStart?: (event: CalendarEvent) => void | Promise<void>;
  confirmDisconnect?: () => boolean | Promise<boolean>;
};
