import { sessions } from "../../packages/sessions/service.ts";
import { sessionHistory } from "../../packages/sessions/history.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";

export function sessionServices(
  repository: SessionRepository,
  workspace: WorkspaceService,
) {
  const service = sessions({
    repository,
    identifier: () => Bun.randomUUIDv7(),
    clock: () => new Date(),
    mode: async (workspaceId, id) =>
      (await workspace.find(workspaceId)).modes.find(
        (mode) => mode.id === id,
      ) ?? null,
  });
  return { service, history: sessionHistory(repository, service) };
}
