import { Elysia } from "elysia";
import type { CalendarService } from "../../packages/calendar/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { localeFrom, message } from "../../packages/i18n/messages.ts";
function present(
  value: Awaited<ReturnType<CalendarService["cached"]>>,
  request: Request,
) {
  const { errorCode, configurationCode, events, ...status } = value;
  const locale = localeFrom(request.headers.get("accept-language"));
  return {
    ...status,
    error: errorCode ? message(errorCode, locale) : "",
    configurationMessage: configurationCode
      ? message(configurationCode, locale)
      : "",
    events: events.map((event) => ({
      ...event,
      title: event.title || message("calendar_untitled", locale),
    })),
  };
}
export function calendarRoutes(
  service: CalendarService,
  identity: Identity,
  prefix: string,
  local: boolean,
) {
  return new Elysia({ name: `calendar-${prefix}`, prefix })
    .get("/calendar/callback", async ({ request, query }) => {
      const principal = await identity.resolve(request);
      if (!local && !principal) throw new HttpError("unauthorized", 401);
      const result = await service.callback(
        principal?.workspaceId ?? null,
        query,
      );
      const locale = localeFrom(request.headers.get("accept-language"));
      const title = message(
        result.result === "connected"
          ? "calendar_connected"
          : "calendar_declined",
        locale,
      );
      return new Response(
        `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orvunia — ${title}</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fafafa;color:#222;font-family:system-ui,sans-serif"><main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:24px;font-weight:500">${title}</h1><p style="color:#666;line-height:1.6">${message("calendar_return", locale)}</p></main></body></html>`,
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
          },
        },
      );
    })
    .use(
      new Elysia({ name: `calendar-private-${prefix}` })
        .resolve(async ({ request }) => {
          const principal = await identity.resolve(request);
          if (!principal) throw new HttpError("unauthorized", 401);
          return { principal };
        })
        .get("/calendar", async ({ principal, request }) =>
          present(await service.cached(principal.workspaceId), request),
        )
        .post("/calendar/connect", ({ principal }) =>
          service.connect(principal.workspaceId),
        )
        .post("/calendar/sync", async ({ principal, request }) =>
          present(await service.sync(principal.workspaceId), request),
        )
        .delete("/calendar", async ({ principal, request }) =>
          present(await service.disconnect(principal.workspaceId), request),
        ),
    );
}
