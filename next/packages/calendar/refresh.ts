import { z } from "zod";
import { CalendarError } from "./domain.ts";
import type { CalendarRecord } from "./domain.ts";
import type { CalendarContext } from "./context.ts";
import { configuredGoogle } from "./context.ts";
const tokens = z
  .object({
    accessToken: z.string().min(1).max(8192),
    refreshToken: z.string().min(1).max(8192).optional(),
    expiresAt: z.number().finite().positive(),
  })
  .strict();
async function read(context: CalendarContext, account: CalendarRecord | null) {
  if (!account?.tokens) throw new CalendarError("calendar_connection");
  try {
    return tokens.parse(JSON.parse(await context.vault.open(account.tokens)));
  } catch {
    throw new CalendarError("calendar_tokens", 409, true);
  }
}
export async function freshCalendarTokens(
  context: CalendarContext,
  workspaceId: string,
  signal: AbortSignal,
  forceVersion?: number,
) {
  const google = configuredGoogle(context),
    lease = context.nonce(),
    deadline = context.clock() + 20_000;
  while (context.clock() < deadline) {
    signal.throwIfAborted();
    const account = await context.repository.find(workspaceId),
      saved = await read(context, account);
    if (!account) throw new CalendarError("calendar_connection");
    if (
      (forceVersion === undefined || forceVersion !== account.tokenVersion) &&
      saved.expiresAt > context.clock() + 60_000
    )
      return { tokens: saved, account };
    const claimed = await context.change(workspaceId, (current) => {
      if (
        current.epoch !== account.epoch ||
        current.tokenVersion !== account.tokenVersion
      )
        return null;
      if (current.refresh && current.refresh.expiresAt > context.clock())
        return null;
      return {
        ...current,
        refresh: { id: lease, expiresAt: context.clock() + 20_000 },
      };
    });
    if (claimed.refresh?.id !== lease) {
      await context.pause(50);
      continue;
    }
    try {
      if (!saved.refreshToken)
        throw new CalendarError("calendar_tokens", 409, true);
      const data = await google.token(
        { refresh_token: saved.refreshToken, grant_type: "refresh_token" },
        signal,
      );
      const next = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? saved.refreshToken,
        expiresAt: context.clock() + data.expires_in * 1000,
      };
      const encrypted = await context.vault.seal(JSON.stringify(next));
      const updated = await context.change(workspaceId, (current) => {
        if (
          current.epoch !== account.epoch ||
          current.tokenVersion !== account.tokenVersion ||
          current.refresh?.id !== lease
        )
          throw new CalendarError("calendar_cancelled");
        return {
          ...current,
          tokens: encrypted,
          tokenVersion: current.tokenVersion + 1,
          refresh: null,
        };
      });
      return { tokens: next, account: updated };
    } finally {
      await context.change(workspaceId, (current) =>
        current.refresh?.id === lease ? { ...current, refresh: null } : null,
      );
    }
  }
  throw new CalendarError("calendar_unavailable", 503);
}
