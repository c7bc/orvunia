import { sessionIndex } from "../../packages/search/service.ts";
import type { SessionIndexRepository } from "../../packages/search/projection.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { conversations } from "../../packages/conversations/service.ts";
import { sessionServices } from "./session-services.ts";
import type { WorkspaceRepository } from "../../packages/workspaces/repository.ts";
import type { ConversationRepository } from "../../packages/conversations/repository.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";

export function applicationServices(repositories: {
  workspaces: WorkspaceRepository;
  conversations: ConversationRepository;
  sessions: SessionRepository;
  index: SessionIndexRepository;
}) {
  const clock = () => new Date(),
    identifier = () => Bun.randomUUIDv7();
  const workspace = workspaces(repositories.workspaces, clock);
  return {
    index: sessionIndex(repositories.index),
    workspace: {
      service: workspace,
      modes: modes(workspace, identifier, clock),
    },
    conversations: conversations(repositories.conversations, identifier, clock),
    sessions: sessionServices(repositories.sessions, workspace),
  };
}
