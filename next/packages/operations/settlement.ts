import type { ExecutionDependencies } from "./execution.ts";
import type { Operation, OperationResult } from "./domain.ts";
import { ProviderError } from "../providers/domain.ts";
import { completedCharge } from "./measurement.ts";

export async function commitOperation(
  dependencies: ExecutionDependencies,
  operation: Operation,
  reservationId: string,
  result: Pick<OperationResult, "model" | "usage">,
) {
  const charge = completedCharge(operation, result);
  await dependencies.usage
    .commit(
      operation.workspaceId,
      reservationId,
      charge.actual,
      charge.measurement,
    )
    .catch(() =>
      dependencies.log({
        event: "usage_commit_pending",
        operationId: operation.id,
      }),
    );
}

export async function failOperationOutcome(
  dependencies: ExecutionDependencies,
  operation: Operation,
  reservationId: string | null,
  outcome: { upstreamInvoked: boolean; partial: boolean; error: unknown; preparationRejected: boolean },
) {
  const known =
    outcome.preparationRejected || !outcome.upstreamInvoked ||
    (outcome.error instanceof ProviderError &&
      [
        "provider_auth",
        "provider_request",
        "provider_limit",
        "provider_incomplete",
        "vision_disabled",
      ].includes(outcome.error.code));
  await dependencies.operations
    .fail(
      operation.workspaceId,
      operation.kind,
      operation.id,
      operation.lease,
      { known, partial: outcome.partial },
    )
    .catch(() =>
      dependencies.log({
        event: "operation_outcome_pending",
        operationId: operation.id,
      }),
    );
  if (!reservationId) return;
  if (outcome.partial) {
    await commitOperation(dependencies, operation, reservationId, {
      model: operation.snapshot!.provider.model,
    });
    return;
  }
  const settlement = known
    ? dependencies.usage.release(operation.workspaceId, reservationId, true)
    : dependencies.usage.unknown(operation.workspaceId, reservationId);
  await settlement.catch(() =>
    dependencies.log({
      event: "usage_outcome_pending",
      operationId: operation.id,
    }),
  );
}
