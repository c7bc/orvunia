import { calendarScope, emptyCalendar } from "./domain.ts";
import type { CalendarDependencies } from "./dependencies.ts";
import { calendarContext } from "./context.ts";
import { connectCalendar, calendarCallback } from "./oauth.ts";
import { syncCalendar } from "./sync.ts";
export function calendar(dependencies: CalendarDependencies) {
  const controller = new AbortController(),
    context = calendarContext(dependencies, controller.signal);
  const active = new Set<Promise<unknown>>();
  async function run<Result>(work: () => Promise<Result>) {
    controller.signal.throwIfAborted();
    const task = work();
    active.add(task);
    try {
      return await task;
    } finally {
      active.delete(task);
    }
  }
  const cached = async (workspaceId: string) => {
    const account =
      (await dependencies.repository.find(workspaceId)) ??
      emptyCalendar(workspaceId);
    return {
      configured: Boolean(context.google),
      connected: Boolean(account.tokens),
      reconnectRequired: account.reconnect,
      syncedAt: account.syncedAt,
      errorCode: account.error,
      protection: dependencies.protection,
      scope: calendarScope,
      callbackURL: context.google ? context.callbackUrl : "",
      configurationCode: context.google
        ? null
        : ("calendar_configuration" as const),
      events: account.events,
      truncated: account.truncated,
    };
  };
  return {
    cached,
    connect: (workspaceId: string) =>
      run(() => connectCalendar(context, workspaceId)),
    callback: (workspaceId: string | null, query: unknown) =>
      run(() => calendarCallback(context, workspaceId, query)),
    sync: (workspaceId: string) =>
      run(async () => {
        await syncCalendar(context, workspaceId);
        return cached(workspaceId);
      }),
    disconnect: (workspaceId: string) =>
      run(async () => {
        await context.change(workspaceId, (current) => ({
          ...emptyCalendar(workspaceId),
          revision: current.revision,
          epoch: current.epoch + 1,
          tokenVersion: current.tokenVersion + 1,
        }));
        return cached(workspaceId);
      }),
    async close() {
      controller.abort();
      await Promise.allSettled(active);
    },
  };
}
export type CalendarService = ReturnType<typeof calendar>;
