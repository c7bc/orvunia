import { CalendarError } from "./domain.ts";
import type { CalendarContext } from "./context.ts";
import { configuredGoogle } from "./context.ts";
import { freshCalendarTokens } from "./refresh.ts";
export async function syncCalendar(
  context: CalendarContext,
  workspaceId: string,
) {
  const google = configuredGoogle(context),
    lease = context.nonce();
  const started = context.clock(),
    signal = AbortSignal.any([context.signal, AbortSignal.timeout(25_000)]);
  const claimed = await context.change(workspaceId, (current) => {
    if (!current.tokens) throw new CalendarError("calendar_connection");
    if (current.sync && current.sync.expiresAt > context.clock()) return null;
    // A failed CAS may resume after another replica completed and released its lease.
    if (!current.error && current.syncedAt && Date.parse(current.syncedAt) >= started) return null;
    return { ...current, sync: { id: lease, expiresAt: started + 35_000 } };
  });
  if (claimed.sync?.id !== lease) {
    while (context.clock() < started + 35_000) {
      signal.throwIfAborted();
      const current = await context.repository.find(workspaceId);
      if (
        !current?.sync ||
        current.sync.id !== claimed.sync?.id ||
        current.sync.expiresAt <= context.clock()
      )
        return;
      await context.pause(50);
    }
    throw new CalendarError("calendar_unavailable", 503);
  }
  try {
    let fresh = await freshCalendarTokens(context, workspaceId, signal);
    if (fresh.account.epoch !== claimed.epoch)
      throw new CalendarError("calendar_cancelled");
    const result = await google.events(
      fresh.tokens.accessToken,
      async () => {
        fresh = await freshCalendarTokens(
          context,
          workspaceId,
          signal,
          fresh.account.tokenVersion,
        );
        return fresh.tokens.accessToken;
      },
      started,
      signal,
    );
    await context.change(workspaceId, (current) => {
      if (current.epoch !== claimed.epoch || current.sync?.id !== lease)
        throw new CalendarError("calendar_cancelled");
      return {
        ...current,
        ...result,
        syncedAt: new Date(context.clock()).toISOString(),
        error: null,
        reconnect: false,
      };
    });
  } catch (error) {
    const failure =
      error instanceof CalendarError
        ? error
        : new CalendarError("calendar_unavailable", 502);
    await context.change(workspaceId, (current) =>
      current.epoch === claimed.epoch && current.sync?.id === lease
        ? { ...current, error: failure.code, reconnect: failure.reconnect }
        : null,
    );
    throw failure;
  } finally {
    await context.change(workspaceId, (current) =>
      current.sync?.id === lease ? { ...current, sync: null } : null,
    );
  }
}
