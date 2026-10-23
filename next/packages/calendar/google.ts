import { z } from "zod";
import type { HttpFetch } from "../providers/http.ts";
import { boundedFetch } from "../providers/http.ts";
import { CalendarError } from "./domain.ts";
import type { CalendarEvent } from "./domain.ts";
import { googleEvents, projectEvents } from "./events.ts";
const token = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192).optional(),
  expires_in: z.number().positive().max(86400).default(3600),
  scope: z.string().max(20000).optional(),
});
export function googleCalendar(
  transport: HttpFetch,
  credentials: { clientId: string; clientSecret: string },
  callback: string,
) {
  const send = boundedFetch(transport);
  return {
    async token(fields: Record<string, string>, signal: AbortSignal) {
      try {
        const response = await send("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            ...fields,
          }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new CalendarError(
            "calendar_tokens",
            [400, 401].includes(response.status) ? 409 : 502,
            [400, 401].includes(response.status),
          );
        }
        return token.parse(await response.json());
      } catch (error) {
        if (error instanceof CalendarError) throw error;
        throw new CalendarError("calendar_unavailable", 502);
      }
    },
    async events(
      accessToken: string,
      refresh: () => Promise<string>,
      now: number,
      signal: AbortSignal,
    ) {
      const events: CalendarEvent[] = [];
      let nextPage = "",
        page = 0,
        credential = accessToken;
      do {
        const url = new URL(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        );
        url.search = new URLSearchParams({
          timeMin: new Date(now).toISOString(),
          timeMax: new Date(now + 30 * 86400000).toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          showDeleted: "false",
          maxResults: String(Math.min(250, 1000 - events.length)),
          fields:
            "items(id,summary,start,end,htmlLink,hangoutLink,conferenceData(entryPoints(entryPointType,uri)),location,status),nextPageToken,timeZone",
          ...(nextPage ? { pageToken: nextPage } : {}),
        }).toString();
        const request = () =>
          send(url, {
            headers: { Authorization: `Bearer ${credential}` },
            signal,
          });
        let response = await request();
        if (response.status === 401) {
          await response.body?.cancel();
          credential = await refresh();
          response = await request();
        }
        if (!response.ok) {
          await response.body?.cancel();
          const denied = [401, 403].includes(response.status);
          throw new CalendarError(
            denied ? "calendar_denied" : "calendar_unavailable",
            denied ? 409 : 502,
            denied,
          );
        }
        const data = googleEvents.parse(await response.json());
        events.push(...projectEvents(data).slice(0, 1000 - events.length));
        nextPage = data.nextPageToken ?? "";
      } while (nextPage && events.length < 1000 && ++page < 20);
      return { events, truncated: Boolean(nextPage) };
    },
    authorization(state: string, challenge: string) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: callback,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.events.readonly",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
      }).toString();
      return url.href;
    },
  };
}
