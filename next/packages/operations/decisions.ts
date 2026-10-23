import type {
  Operation,
  ClaimContext,
  OperationFailure,
  OperationResult,
} from "./domain.ts";
import { OperationError } from "./domain.ts";

export function claimOperation(candidate: Operation, context: ClaimContext) {
  if (!context.session) throw new OperationError("conversation_not_found");
  const prior = context.existing;
  if (
    !prior &&
    candidate.snapshot?.historyGeneration !== undefined &&
    candidate.snapshot.historyGeneration !== context.session.historyGeneration
  )
    throw new OperationError("history_changed");
  if (
    prior &&
    (prior.workspaceId !== candidate.workspaceId ||
      prior.conversationId !== candidate.conversationId ||
      prior.requestHash !== candidate.requestHash)
  )
    throw new OperationError("request_conflict");
  if (prior?.state === "completed") {
    if (!prior.result) throw new OperationError("operation_expired");
    return prior;
  }
  if (
    prior &&
    (prior.state === "expired" ||
      prior.expiresAt <= candidate.createdAt ||
      !prior.snapshot)
  )
    throw new OperationError("operation_expired");
  if (prior?.state === "unknown") return prior;
  if (prior && ["prepared", "running"].includes(prior.state)) {
    if (prior.leaseUntil > candidate.createdAt)
      throw new OperationError("operation_busy");
    if (prior.providerStarted) return { ...prior, state: "unknown" as const };
  }
  if (
    context.session.state === "ended" &&
    !(prior?.snapshot ?? candidate.snapshot)?.allowEnded
  )
    throw new OperationError("conversation_ended");
  const concurrentLimit = candidate.kind === "transcription" ? 2 : 1;
  if (context.activeCount >= concurrentLimit)
    throw new OperationError("operation_busy");
  if (
    !prior &&
    context.retainedBytes + candidate.snapshotBytes > 128 * 1024 * 1024
  )
    throw new OperationError("snapshot_limit");
  return prior
    ? {
        ...prior,
        attempt: prior.attempt + 1,
        state: "prepared" as const,
        lease: candidate.lease,
        leaseUntil: candidate.leaseUntil,
        cancelRequested: false,
        providerStarted: false,
        partial: false,
        reservationId: null,
      }
    : candidate;
}
export function assertLease(operation: Operation | undefined, lease: string) {
  if (!operation || operation.lease !== lease || operation.state === "expired")
    throw new OperationError("request_conflict");
  return operation;
}
export function startOperation(current: Operation, lease: string) {
  assertLease(current, lease);
  if (current.cancelRequested || current.state !== "prepared")
    throw new OperationError("operation_busy");
  return { ...current, state: "running" as const, providerStarted: true };
}
export function failOperation(
  current: Operation,
  lease: string,
  failure: OperationFailure,
): Operation {
  assertLease(current, lease);
  if (current.state === "completed") return current;
  return {
    ...current,
    state: failure.known || !current.providerStarted ? "failed" : "unknown",
    partial: current.partial || failure.partial,
    leaseUntil: 0,
  };
}
export function completeOperation(
  current: Operation,
  lease: string,
  result: OperationResult,
): Operation {
  assertLease(current, lease);
  if (current.state === "completed") return current;
  if (current.cancelRequested) throw new OperationError("operation_busy");
  if (!["running", "unknown"].includes(current.state))
    throw new OperationError("request_conflict");
  return { ...current, state: "completed", result, leaseUntil: 0 };
}

export function assertOperationSession(
  operation: Operation,
  session: { state: string },
) {
  if (session.state === "ended" && !operation.snapshot?.allowEnded)
    throw new OperationError("conversation_ended");
}
