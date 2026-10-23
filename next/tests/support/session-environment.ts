import { sessions } from "../../packages/sessions/service.ts";
import { sessionHistory } from "../../packages/sessions/history.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";

export type SessionFixture = () => Promise<{
  repository: SessionRepository;
  workspace: WorkspaceService;
}>;
export async function sessionEnvironment(fixture: SessionFixture) {
  const { repository, workspace } = await fixture();
  const owner = crypto.randomUUID();
  const service = sessions({
    repository,
    identifier: () => crypto.randomUUID(),
    clock: () => new Date(),
    mode: async (workspaceId, id) =>
      (await workspace.find(workspaceId)).modes.find(
        (mode) => mode.id === id,
      ) ?? null,
  });
  return {
    repository,
    workspace,
    owner,
    service,
    history: sessionHistory(repository, service),
  };
}

export type SessionEnvironment = Awaited<ReturnType<typeof sessionEnvironment>>;
