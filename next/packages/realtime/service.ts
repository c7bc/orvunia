import type { Peer, Ticket } from "./domain.ts";
import { RealtimeError } from "./domain.ts";
import type { RealtimeDependencies } from "./dependencies.ts";
import type { Principal } from "../identity/principal.ts";
import { LiveChannel } from "./channel.ts";
export function realtime(dependencies: RealtimeDependencies) {
  const channels = new Set<LiveChannel>();
  let closing = false;
  const assertOpen = () => {
    if (closing) throw new RealtimeError("realtime_closed");
  };
  const assertSupported = () => {
    if (!dependencies.providers.realtime())
      throw new RealtimeError("realtime_unsupported", 503);
  };
  return {
    async issue(principal: Principal, sessionId: string, who: Ticket["who"]) {
      assertOpen();
      assertSupported();
      const session = await dependencies.sessions.find(
        principal.workspaceId,
        sessionId,
      );
      if (!session || session.state !== "active")
        throw new RealtimeError("realtime_closed");
      const id = dependencies.identifier();
      await dependencies.tickets.put({
        id,
        userId: principal.userId,
        workspaceId: principal.workspaceId,
        sessionId,
        who,
        locale: principal.locale,
        historyGeneration: session.historyGeneration,
        expiresAt: dependencies.clock() + 30_000,
      });
      return { ticket: id };
    },
    async accept(request: Request, id: string) {
      assertOpen();
      assertSupported();
      if (request.headers.get("origin") !== dependencies.origin)
        throw new RealtimeError("realtime_closed", 403);
      const principal = await dependencies.identity.resolve(request);
      if (!dependencies.local && !principal)
        throw new RealtimeError("realtime_closed", 401);
      const ticket = await dependencies.tickets.take(id);
      if (
        !ticket ||
        ticket.expiresAt <= dependencies.clock() ||
        (principal &&
          (principal.workspaceId !== ticket.workspaceId ||
            principal.userId !== ticket.userId))
      )
        throw new RealtimeError("realtime_closed", 401);
      const session = await dependencies.sessions.find(
        ticket.workspaceId,
        ticket.sessionId,
      );
      if (
        !session ||
        session.state !== "active" ||
        session.historyGeneration !== ticket.historyGeneration
      )
        throw new RealtimeError("realtime_closed");
      return ticket;
    },
    open(ticket: Ticket, peer: Peer, request: Request) {
      assertOpen();
      assertSupported();
      const channel = new LiveChannel(dependencies, ticket, peer, async () => {
        if (dependencies.local) return !closing;
        const principal = await dependencies.identity.resolve(request);
        return (
          principal?.workspaceId === ticket.workspaceId &&
          principal.userId === ticket.userId
        );
      });
      channels.add(channel);
      return {
        receive: (value: unknown) => channel.receive(value),
        close: async () => {
          try {
            await channel.close();
          } finally {
            channels.delete(channel);
          }
        },
      };
    },
    async stopWorkspace(workspaceId: string) {
      const owned = [...channels].filter(
        (channel) => channel.state.ticket.workspaceId === workspaceId,
      );
      await Promise.allSettled(owned.map((channel) => channel.close()));
      owned.forEach((channel) => channels.delete(channel));
    },
    async close() {
      closing = true;
      await Promise.allSettled([...channels].map((channel) => channel.close()));
      channels.clear();
    },
  };
}
export type RealtimeService = ReturnType<typeof realtime>;
