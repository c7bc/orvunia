import type { SessionRepository } from "../sessions/repository.ts";
import { validateTranscriptSources } from "../answers/transcript-sources.ts";
import { OperationError } from "../operations/domain.ts";
import { RepositoryAgentError } from "./domain.ts";
import type { AgentDependencies } from "./ports.ts";

export function repositoryTranscriptSources(repository: SessionRepository): AgentDependencies["validateSources"] {
  return async (owner, ids, historyGeneration) => {
    try {
      await validateTranscriptSources(repository, owner.workspaceId, owner.sessionId, ids, historyGeneration, false);
    } catch (error) {
      if (error instanceof OperationError) throw new RepositoryAgentError(error.code);
      throw error;
    }
  };
}
