import { createHash } from "node:crypto";
import type { Operation } from "../operations/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { ProviderError } from "../providers/domain.ts";
import type { ExpansionDependencies } from "./dependencies.ts";
import { ExpansionError } from "./domain.ts";
import { expansionContext } from "./context.ts";
import { expansionStatus } from "./status.ts";

export async function prepareExpansion(
  dependencies: ExpansionDependencies,
  workspaceId: string,
  id: string,
  sourceId: string,
  requestId: string,
) {
  const status = await expansionStatus(dependencies, workspaceId, id, sourceId);
  if (["generating", "ready", "revealed"].includes(status.status))
    return { status };
  if (status.status === "expired")
    throw new ExpansionError("expansion_expired");
  if ("requestId" in status && status.requestId !== requestId)
    throw new OperationError("request_conflict");
  if (!dependencies.capabilities && !dependencies.providers.ready("response"))
    throw new ProviderError("provider_not_configured", 503);
  const existing = await dependencies.operations.find(
    workspaceId,
    "expansion",
    requestId,
  );
  if (existing?.state === "unknown")
    throw new OperationError("operation_unknown");
  const context = existing?.snapshot
    ? {
        snapshot: existing.snapshot,
        contextSource:
          "contextSource" in status
            ? status.contextSource
            : ("saved-answer-only" as const),
      }
    : await expansionContext(
        dependencies,
        workspaceId,
        id,
        sourceId,
        requestId,
      );
  const now = dependencies.clock();
  const stage = await dependencies.stages.create({
    sourceId,
    workspaceId,
    conversationId: id,
    requestId,
    expiresAt: now + 24 * 60 * 60_000,
    revealed: false,
    cancelled: false,
    contextSource: context.contextSource,
  });
  if (stage.requestId !== requestId)
    return {
      status: await expansionStatus(dependencies, workspaceId, id, sourceId),
    };
  await dependencies.stages.reset(workspaceId, sourceId, requestId);
  const candidate: Operation = {
    id: requestId,
    kind: "expansion",
    workspaceId,
    conversationId: id,
    requestHash: createHash("sha256")
      .update(
        JSON.stringify({ source: sourceId, requestId, kind: "tell-me-more" }),
      )
      .digest("hex"),
    state: "prepared",
    attempt: 1,
    snapshot: context.snapshot,
    snapshotBytes: 0,
    result: null,
    lease: dependencies.identifier(),
    leaseUntil: now + 90_000,
    expiresAt: stage.expiresAt,
    createdAt: now,
    cancelRequested: false,
    providerStarted: false,
    partial: false,
    reservationId: null,
  };
  let operation: Operation;
  try {
    operation = await dependencies.operations.claim(candidate);
  } catch (error) {
    if (error instanceof OperationError && error.code === "operation_busy") {
      const current = await dependencies.operations.find(
        workspaceId,
        "expansion",
        requestId,
      );
      if (current?.state === "prepared" || current?.state === "running")
        return {
          status: await expansionStatus(
            dependencies,
            workspaceId,
            id,
            sourceId,
          ),
        };
    }
    throw error;
  }
  if (operation.state === "unknown")
    throw new OperationError("operation_unknown");
  if (operation.state === "completed")
    return {
      status: await expansionStatus(dependencies, workspaceId, id, sourceId),
    };
  if ((await dependencies.stages.find(workspaceId, id, sourceId))?.cancelled) {
    await dependencies.operations.fail(
      workspaceId,
      "expansion",
      requestId,
      operation.lease,
      { known: true, partial: false },
    );
    return {
      status: await expansionStatus(dependencies, workspaceId, id, sourceId),
    };
  }
  return { operation };
}
