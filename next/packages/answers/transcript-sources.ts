import type { SessionRepository } from "../sessions/repository.ts";
import { OperationError } from "../operations/domain.ts";
import { sourceTranscriptIdsSchema } from "../contracts/answers.ts";
export async function validateTranscriptSources(repository: Pick<SessionRepository, "find" | "entry">, workspaceId: string,
  sessionId: string, ids: readonly string[] | undefined, historyGeneration: number | undefined,
  allowEnded: boolean) {
  if (!ids?.length) return;
  if (!sourceTranscriptIdsSchema.safeParse(ids).success) throw new OperationError("history_changed");
  const current = await repository.find(workspaceId, sessionId);
  if (!current) throw new OperationError("conversation_not_found");
  if (current.historyGeneration !== historyGeneration) throw new OperationError("history_changed");
  if (current.state !== "active" && !allowEnded) throw new OperationError("conversation_ended");
  const entries = await Promise.all(ids.map(id => repository.entry(workspaceId, sessionId, id, "transcripts")));
  if (entries.some((entry, index) => !entry || entry.kind !== "transcripts" || entry.conversationId !== sessionId || entry.id !== ids[index]))
    throw new OperationError("history_changed");
  const latest = await repository.find(workspaceId, sessionId);
  if (!latest || latest.historyGeneration !== historyGeneration) throw new OperationError("history_changed");
  if (latest.state !== "active" && !allowEnded) throw new OperationError("conversation_ended");
}
