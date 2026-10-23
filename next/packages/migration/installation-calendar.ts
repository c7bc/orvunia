import { z } from "zod";
import { emptyCalendar } from "../calendar/domain.ts";
import type { SecretVault } from "../providers/domain.ts";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
const safeLink = z
  .string()
  .max(10000)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });
const event = z
  .object({
    id: z.string().min(1).max(1000),
    title: z.string().max(10000),
    start: z.string().min(1).max(100),
    end: z.string().min(1).max(100),
    allDay: z.boolean(),
    timeZone: z.string().max(100),
    location: z.string().max(10000),
    url: safeLink,
    joinUrl: safeLink,
  })
  .strict();
const tokens = z
  .object({
    accessToken: z.string().min(1).max(8192),
    refreshToken: z.string().max(8192).optional(),
    expiresAt: z.number().nonnegative().finite(),
  })
  .strict();
const connection = z.object({
  owner_id: z.uuid(),
  tokens: z.string().max(40000),
  events: z.string(),
  synced_at: z.string().nullable(),
  error: z.string(),
  reconnect: z.union([z.literal(0), z.literal(1)]),
});
const authorization = z.object({
  state_hash: z.string().regex(/^[a-f0-9]{64}$/),
  owner_id: z.uuid(),
  verifier: z.string().min(1).max(40000),
  expires_at: z.number().int().nonnegative(),
});
export async function projectInstallationCalendar(
  reader: LegacyReader,
  projection: LegacyProjection,
  open: (value: string) => Promise<string>,
  target: SecretVault,
  now: number,
) {
  const owners = new Set(projection.workspaces.map((value) => value.id)),
    records = new Map(
      projection.calendars.map((value) => [value.workspaceId, value]),
    );
  const own = (owner: string) => {
    if (!owners.has(owner))
      throw Error("Legacy calendar has inconsistent ownership");
    return records.get(owner) ?? emptyCalendar(owner);
  };
  for (const row of reader.rows("calendar_connections")) {
    const value = connection.parse(row),
      record = own(value.owner_id),
      payload = tokens.parse(JSON.parse(await open(value.tokens)));
    record.tokens = await target.seal(JSON.stringify(payload));
    record.events = z.array(event).max(1000).parse(JSON.parse(value.events));
    record.syncedAt = value.synced_at;
    record.reconnect = value.reconnect === 1;
    record.error = value.error
      ? record.reconnect
        ? "calendar_tokens"
        : "calendar_unavailable"
      : null;
    records.set(record.workspaceId, record);
  }
  for (const row of reader.rows("calendar_oauth_states")) {
    const value = authorization.parse(row);
    if (value.expires_at <= now) continue;
    const record = own(value.owner_id);
    if (record.authorization)
      throw Error(
        "Multiple active legacy calendar authorizations for one workspace",
      );
    const verifier = z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(await open(value.verifier));
    record.authorization = {
      hash: value.state_hash,
      verifier: await target.seal(verifier),
      expiresAt: value.expires_at,
    };
    records.set(record.workspaceId, record);
  }
  projection.calendars = [...records.values()];
}
