import type { CalendarDependencies } from "./dependencies.ts";
import { calendarMutation } from "./mutation.ts";
import { googleCalendar } from "./google.ts";
import { CalendarError } from "./domain.ts";
export function calendarContext(
  dependencies: CalendarDependencies,
  signal: AbortSignal,
) {
  const origin = new URL(dependencies.origin);
  if (
    origin.origin !== dependencies.origin ||
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
      ))
  )
    throw Error("Calendar requires a fixed HTTPS or loopback origin");
  return {
    ...dependencies,
    signal,
    change: calendarMutation(dependencies.repository),
    callbackUrl: new URL("/api/calendar/callback", dependencies.origin).href,
    google: dependencies.google
      ? googleCalendar(
          dependencies.transport,
          dependencies.google,
          new URL("/api/calendar/callback", dependencies.origin).href,
        )
      : null,
  };
}
export type CalendarContext = ReturnType<typeof calendarContext>;
export function configuredGoogle(context: CalendarContext) {
  context.signal.throwIfAborted();
  if (!context.google) throw new CalendarError("calendar_configuration", 503);
  return context.google;
}
