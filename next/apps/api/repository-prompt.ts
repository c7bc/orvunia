import type { WorkspaceService } from "../../packages/workspaces/service.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { AgentOwner } from "../../packages/repository-agent/domain.ts";
import { RepositoryAgentError } from "../../packages/repository-agent/domain.ts";
import { selectedModeConfiguration } from "../../packages/answers/mode-prompt.ts";

export function repositoryPrompt(workspaces: WorkspaceService, sessions: SessionRepository) {
  return async (owner: AgentOwner) => {
    const [workspace, session] = await Promise.all([
      workspaces.find(owner.workspaceId), sessions.find(owner.workspaceId, owner.sessionId),
    ]);
    if (!session) throw new RepositoryAgentError("repository_agent_not_found", 404);
    const mode = selectedModeConfiguration(workspace, session.modeSnapshot, session.mode);
    return [`# System prompt\n${mode.systemPrompt}`, `# Mode instructions\n${mode.instructions}`,
      `# Output language\n${workspace.preferences.output}`].join("\n\n");
  };
}
