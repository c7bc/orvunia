import type { ExpansionDependencies } from "./dependencies.ts";
import { operationSupervisor } from "../operations/supervisor.ts";
import { runAnswer } from "../answers/run.ts";
import { prepareExpansion } from "./prepare.ts";
import { expansionStatus } from "./status.ts";
import { OperationError } from "../operations/domain.ts";

export function expansions(dependencies: ExpansionDependencies) {
  const supervisor = operationSupervisor(),
    jobs = new Map<string, { controller: AbortController; lease: string }>();
  const status = (workspaceId: string, id: string, sourceId: string) =>
    expansionStatus(dependencies, workspaceId, id, sourceId);
  return {
    status,
    async prepare(
      workspaceId: string,
      id: string,
      sourceId: string,
      requestId: string,
      authorized: () => Promise<boolean>,
    ) {
      supervisor.assertOpen();
      if (!(await authorized())) throw new OperationError("unauthorized");
      const prepared = await prepareExpansion(
        dependencies,
        workspaceId,
        id,
        sourceId,
        requestId,
      );
      if ("status" in prepared) return prepared.status;
      const operation = prepared.operation,
        controller = new AbortController();
      jobs.set(requestId, { controller, lease: operation.lease });
      void supervisor
        .run(controller.signal, (signal) =>
          runAnswer(dependencies, operation, signal, () => {}, authorized),
        )
        .catch(() =>
          dependencies.log({
            event: "expansion_generation_failed",
            operationId: requestId,
          }),
        )
        .finally(() => {
          if (jobs.get(requestId)?.lease === operation.lease)
            jobs.delete(requestId);
        });
      return status(workspaceId, id, sourceId);
    },
    async reveal(
      workspaceId: string,
      id: string,
      sourceId: string,
      requestId: string,
    ) {
      await status(workspaceId, id, sourceId);
      await dependencies.stages.reveal(
        workspaceId,
        sourceId,
        requestId,
        dependencies.clock(),
      );
      return status(workspaceId, id, sourceId);
    },
    async cancel(
      workspaceId: string,
      id: string,
      sourceId: string,
      requestId: string,
    ) {
      await status(workspaceId, id, sourceId);
      await dependencies.stages.cancel(workspaceId, sourceId, requestId);
      jobs.get(requestId)?.controller.abort();
      return status(workspaceId, id, sourceId);
    },
    close: supervisor.close,
  };
}
export type ExpansionService = ReturnType<typeof expansions>;
