import type { ExecutionDependencies, Execution } from "./execution.ts";
import type { Operation, OperationResult } from "./domain.ts";
import { OperationError } from "./domain.ts";
import { commitOperation, failOperationOutcome } from "./settlement.ts";
import { heartbeat } from "./heartbeat.ts";
import { OperationPreparationError } from "./preparation-error.ts";

export async function executeOperation(
  dependencies: ExecutionDependencies,
  operation: Operation,
  signal: AbortSignal,
  authorized: () => Promise<boolean>,
  execution: Execution,
): Promise<OperationResult> {
  const { operations, usage, clock } = dependencies;
  signal.throwIfAborted();
  if (operation.state === "completed" && operation.result) {
    if (!(await authorized())) throw new OperationError("unauthorized");
    if (operation.reservationId)
      await usage.reconcile().catch(() =>
        dependencies.log({
          event: "usage_commit_pending",
          operationId: operation.id,
        }),
      );
    execution.replay?.(operation.result);
    return operation.result;
  }
  if (!operation.snapshot || operation.state !== "prepared")
    throw new OperationError("operation_unknown");
  const abort = new AbortController(),
    combined = AbortSignal.any([
      signal,
      abort.signal,
      AbortSignal.timeout(65_000),
    ]);
  let reservationId: string | null = null,
    upstreamInvoked = false,
    partial = false;
  let stopHeartbeat = async () => {};
  let permit:
    | Awaited<
        ReturnType<NonNullable<ExecutionDependencies["admission"]>["enter"]>
      >
    | undefined;
  try {
    if (!(await authorized())) throw new OperationError("unauthorized");
    permit = await dependencies.admission?.enter();
    const invoke = await execution.prepare(combined);
    combined.throwIfAborted();
    const reservation = await usage.reserve(
      operation.workspaceId,
      execution.kind,
      execution.units,
      `${operation.kind}:${operation.id}:${operation.attempt}`,
    );
    reservationId = reservation.id;
    await operations.start(
      operation.workspaceId,
      operation.kind,
      operation.id,
      operation.lease,
      reservation.id,
    );
    stopHeartbeat = heartbeat(
      async () => {
        if (!(await authorized()) || (permit && !(await permit.renew())))
          return false;
        await usage.renew(operation.workspaceId, reservation.id);
        return operations.renew(
          operation.workspaceId,
          operation.kind,
          operation.id,
          operation.lease,
          clock(),
        );
      },
      () => abort.abort(),
      dependencies.heartbeatMs ?? 10_000,
    );
    combined.throwIfAborted();
    upstreamInvoked = true;
    const output = await invoke(() => {
      partial = true;
    });
    await stopHeartbeat();
    if (!(await authorized())) throw new OperationError("unauthorized");
    combined.throwIfAborted();
    await operations.complete(
      operation.workspaceId,
      operation.kind,
      operation.id,
      operation.lease,
      output,
      new Date(clock()).toISOString(),
    );
    await commitOperation(dependencies, operation, reservation.id, output);
    return output;
  } catch (error) {
    await stopHeartbeat();
    const preparationRejected = error instanceof OperationPreparationError;
    const reason = preparationRejected ? error.reason : error;
    await failOperationOutcome(dependencies, operation, reservationId, {
      upstreamInvoked,
      partial,
      error: reason,
      preparationRejected,
    });
    throw reason;
  } finally {
    await stopHeartbeat();
    await permit?.release().catch(() =>
      dependencies.log({
        event: "admission_release_pending",
        operationId: operation.id,
      }),
    );
  }
}
