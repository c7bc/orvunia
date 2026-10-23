import type { ExpansionDependencies } from "./dependencies.ts";
import { ExpansionError } from "./domain.ts";
import { OperationError } from "../operations/domain.ts";

export async function expansionStatus(
  dependencies: ExpansionDependencies,
  workspaceId: string,
  id: string,
  sourceId: string,
) {
  if (!(await dependencies.sessions.find(workspaceId, id)))
    throw new OperationError("conversation_not_found");
  if (
    !(await dependencies.sessions.entry(workspaceId, id, sourceId, "responses"))
  )
    throw new ExpansionError("response_not_found");
  const stage = await dependencies.stages.find(workspaceId, id, sourceId);
  if (!stage) return { status: "absent" as const };
  const base = {
    sourceResponseId: stage.sourceId,
    requestId: stage.requestId,
    expires: stage.expiresAt,
    contextSource: stage.contextSource,
    cancelled: stage.cancelled,
  };
  if (stage.revealed) {
    const saved = await dependencies.sessions.entry(
      workspaceId,
      id,
      stage.requestId,
      "responses",
    );
    return saved
      ? {
          ...base,
          status: "revealed" as const,
          response: saved.data,
          captureIds: saved.data.captureIds ?? [],
        }
      : {
          ...base,
          status: "expired" as const,
          messageCode: "expansion_expired" as const,
        };
  }
  if (stage.expiresAt <= dependencies.clock())
    return {
      ...base,
      status: "expired" as const,
      messageCode: "expansion_expired" as const,
    };
  const operation = await dependencies.operations.find(
    workspaceId,
    "expansion",
    stage.requestId,
  );
  const captureIds =
    operation?.result?.captureIds ??
    operation?.snapshot?.images.map((image) => image.id) ??
    [];
  if (operation?.state === "completed" && operation.result)
    return { ...base, captureIds, status: "ready" as const };
  if (stage.cancelled)
    return {
      ...base,
      captureIds,
      status: "failed" as const,
      messageCode: "expansion_cancelled" as const,
    };
  if (
    operation &&
    ["prepared", "running"].includes(operation.state) &&
    operation.leaseUntil > dependencies.clock()
  )
    return { ...base, captureIds, status: "generating" as const };
  if (operation?.state === "expired")
    return {
      ...base,
      captureIds,
      status: "expired" as const,
      messageCode: "expansion_expired" as const,
    };
  return {
    ...base,
    captureIds,
    status: "failed" as const,
    messageCode:
      operation?.state === "unknown" ||
      (operation?.state === "running" && operation.providerStarted)
        ? ("operation_unknown" as const)
        : ("provider_unavailable" as const),
  };
}
export type ExpansionStatus = Awaited<ReturnType<typeof expansionStatus>>;
