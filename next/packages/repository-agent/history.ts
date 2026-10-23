import type { SessionRepository } from "../sessions/repository.ts";
import type { AgentJob } from "./domain.ts";
import { agentAssert } from "./limits.ts";
import { repositoryTranscriptSources } from "./source-transcripts.ts";

export function repositoryAgentHistory(sessions: SessionRepository) {
  return async (job: AgentJob) => {
    agentAssert(job.status === "completed" && job.answer, "repository_agent_incomplete");
    await repositoryTranscriptSources(sessions)(job.owner, job.sourceTranscriptIds, job.historyGeneration);
    if (await sessions.entry(job.owner.workspaceId, job.owner.sessionId, job.id, "responses")) return;
    await sessions.change(job.owner.workspaceId, job.owner.sessionId, (session) => {
      agentAssert(session.state === "active", "repository_session_inactive");
      agentAssert(session.historyGeneration === job.historyGeneration, "history_changed");
      return { next: session, append: { id: job.id, conversationId: session.id, kind: "responses", segmentId: null,
        data: { id: job.id, text: job.answer!, action: "repository-review", mode: session.mode,
          model: "Repository assistant", date: new Date(job.updatedAt).toISOString(),
          ...(job.sourceTranscriptIds ? { sourceTranscriptIds: [...job.sourceTranscriptIds] } : {}),
          question: job.messages.findLast((message) => message.kind === "question")?.text ?? "" } } };
    });
  };
}
