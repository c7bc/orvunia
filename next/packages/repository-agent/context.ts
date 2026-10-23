import type { AgentJob, AgentMessage, AgentOwner, AgentStore, RepositoryBinding } from "./domain.ts";
import { agentLimits, encodedBytes } from "./limits.ts";
import { deduplicateRepositoryEvidence } from "./evidence-deduplication.ts";

export function sameRepositoryContext(job: AgentJob, owner: AgentOwner, binding: RepositoryBinding, generation: number) {
  return job.status === "completed" && job.owner.workspaceId === owner.workspaceId
    && job.owner.actorId === owner.actorId && job.owner.sessionId === owner.sessionId
    && job.historyGeneration === generation && job.binding.grantId === binding.grantId
    && job.binding.revision === binding.revision && job.binding.snapshotSha256 === binding.snapshotSha256;
}

export async function repositoryConversation(store: AgentStore, owner: AgentOwner,
  binding: RepositoryBinding, generation: number, question: string): Promise<AgentMessage[]> {
  const current: AgentMessage = { kind: "question", text: question };
  const previous = await store.recent(owner, binding, generation);
  // Keep whole exchanges; never split a provider call from its tool result or pay for hidden summarization.
  for (const job of previous) {
    if (!sameRepositoryContext(job, owner, binding, generation)) continue;
    const messages = deduplicateRepositoryEvidence([...job.messages, current]);
    if (encodedBytes(messages) <= Math.floor(agentLimits.contextBytes * 0.75)) return messages;
  }
  return [current];
}
