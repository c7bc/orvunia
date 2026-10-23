import { createHash } from "node:crypto";
import { z } from "zod";
import type { CalendarContext } from "./context.ts";
import { configuredGoogle } from "./context.ts";
import { CalendarError, calendarScope } from "./domain.ts";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const query = z.object({
  state: z.string().min(20).max(200),
  code: z.string().min(1).max(4096).optional(),
  error: z.string().max(200).optional(),
});
export async function connectCalendar(
  context: CalendarContext,
  workspaceId: string,
) {
  const google = configuredGoogle(context),
    state = context.nonce(),
    verifier = context.nonce();
  const encrypted = await context.vault.seal(verifier);
  await context.change(workspaceId, (current) => ({
    ...current,
    epoch: current.epoch + 1,
    refresh: null,
    sync: null,
    authorization: {
      hash: digest(state),
      verifier: encrypted,
      expiresAt: context.clock() + 600_000,
    },
  }));
  return {
    url: google.authorization(
      state,
      createHash("sha256").update(verifier).digest("base64url"),
    ),
  };
}
export async function calendarCallback(
  context: CalendarContext,
  workspaceId: string | null,
  input: unknown,
) {
  const google = configuredGoogle(context),
    parsed = query.parse(input),
    hash = digest(parsed.state);
  const saved = await context.repository.byState(hash);
  if (!saved || (workspaceId !== null && workspaceId !== saved.workspaceId))
    throw new CalendarError("calendar_state", 400);
  const verifier = saved.authorization?.verifier;
  const claimed = await context.change(saved.workspaceId, (current) => {
    if (
      current.authorization?.hash !== hash ||
      current.authorization.expiresAt <= context.clock()
    )
      throw new CalendarError("calendar_state", 400);
    return { ...current, authorization: null };
  });
  if (parsed.error) return { result: "denied" as const };
  if (!parsed.code || !verifier) throw new CalendarError("calendar_state", 400);
  const data = await google.token(
    {
      code: parsed.code,
      code_verifier: await context.vault.open(verifier),
      grant_type: "authorization_code",
      redirect_uri: context.callbackUrl,
    },
    context.signal,
  );
  const scopes = (data.scope ?? calendarScope).split(" ");
  if (
    ![
      calendarScope,
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar",
    ].some((scope) => scopes.includes(scope))
  )
    throw new CalendarError("calendar_denied", 403, true);
  const tokens = await context.vault.seal(
    JSON.stringify({
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      expiresAt: context.clock() + data.expires_in * 1000,
    }),
  );
  await context.change(saved.workspaceId, (current) => {
    if (current.epoch !== claimed.epoch)
      throw new CalendarError("calendar_cancelled");
    return {
      ...current,
      tokens,
      tokenVersion: current.tokenVersion + 1,
      events: [],
      syncedAt: null,
      error: null,
      reconnect: false,
      truncated: false,
      refresh: null,
      sync: null,
    };
  });
  return { result: "connected" as const };
}
