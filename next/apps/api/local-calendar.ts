import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { LocalSettings } from "../../packages/config/local.ts";
import type { CalendarRepository } from "../../packages/calendar/repository.ts";
import { calendar } from "../../packages/calendar/service.ts";
import { scopedCalendarVault } from "../../packages/calendar/scoped-vault.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import type { Composition } from "./composition.ts";
export function composeCalendar(
  settings: LocalSettings,
  composition: Composition,
  repository: CalendarRepository,
) {
  const clientId = composition.environment.CADENCE_GOOGLE_CLIENT_ID;
  const clientSecret = composition.environment.CADENCE_GOOGLE_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret))
    throw Error("Calendar requires both Google OAuth credentials");
  const google =
    clientId && clientSecret
      ? z
          .object({
            clientId: z.string().min(1).max(2000),
            clientSecret: z.string().min(1).max(4000),
          })
          .parse({ clientId, clientSecret })
      : undefined;
  const vault =
    composition.vault
        ? scopedCalendarVault(composition.vault)
        : fileVault(
            join(dirname(settings.CADENCE_SQLITE_PATH), "calendar.next.key"),
            "cadence.calendar/v1",
          );
  return calendar({
    repository,
    vault,
    transport: composition.transport,
    ...(google ? { google } : {}),
    origin: settings.CADENCE_PUBLIC_URL,
    protection: composition.vault ? "os" : "file",
    clock: Date.now,
    nonce: () => randomBytes(32).toString("base64url"),
    pause: (milliseconds) => Bun.sleep(milliseconds),
  });
}
