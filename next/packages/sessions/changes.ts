import type { SessionRecord, SessionChange } from "./domain.ts";
import { SessionError } from "./domain.ts";

export function assertSessionChange(
  current: SessionRecord,
  change: SessionChange,
) {
  const next = change.next,
    entry = change.append;
  if (
    next.id !== current.id ||
    next.workspaceId !== current.workspaceId ||
    next.createdAt !== current.createdAt ||
    next.revision !== current.revision ||
    next.historyGeneration !==
      current.historyGeneration + (change.clear ? 1 : 0) ||
    (entry &&
      (entry.conversationId !== current.id || entry.id !== entry.data.id))
  )
    throw new SessionError("request_conflict");
  if (current.state === "ended" && next.state !== "ended")
    throw new SessionError("conversation_ended");
}
