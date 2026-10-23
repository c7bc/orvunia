import type { ChannelState } from "./state.ts";
import { RealtimeError } from "./domain.ts";
export async function assertLive(state: ChannelState) {
  if (state.closed) throw new RealtimeError("realtime_closed");
  const { ticket, dependencies } = state;
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
  if (state.closed) throw new RealtimeError("realtime_closed");
  return session;
}
