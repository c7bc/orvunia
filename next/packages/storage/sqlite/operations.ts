import { and, eq, inArray } from "drizzle-orm";
import type { OperationRepository } from "../../operations/repository.ts";
import {
  assertLease,
  assertOperationSession,
  startOperation,
  failOperation,
  completeOperation,
} from "../../operations/decisions.ts";
import type { SqliteConnection } from "./connection.ts";
import { operations } from "./operation-schema.ts";
import { operationWhere } from "./operation-condition.ts";
import { claim } from "./operation-claim.ts";
import { mutate } from "./operation-mutation.ts";
import { recover } from "./operation-recovery.ts";
export class SqliteOperations implements OperationRepository {
  constructor(private readonly connection: SqliteConnection) {}
  claim: OperationRepository["claim"] = (candidate) =>
    claim(this.connection, candidate);
  find: OperationRepository["find"] = async (workspaceId, kind, id) =>
    this.connection.database
      .select()
      .from(operations)
      .where(operationWhere(workspaceId, kind, id))
      .get() ?? null;
  start: OperationRepository["start"] = (
    workspaceId,
    kind,
    id,
    lease,
    reservationId,
  ) =>
    mutate(this.connection, workspaceId, kind, id, (current, session) => {
      assertOperationSession(current, session);
      return { ...startOperation(current, lease), reservationId };
    });
  fail: OperationRepository["fail"] = (workspaceId, kind, id, lease, failure) =>
    mutate(this.connection, workspaceId, kind, id, (current) =>
      failOperation(current, lease, failure),
    );
  complete: OperationRepository["complete"] = (
    workspaceId,
    kind,
    id,
    lease,
    result,
    now,
  ) =>
    mutate(
      this.connection,
      workspaceId,
      kind,
      id,
      (current, session) => {
        assertOperationSession(current, session);
        return completeOperation(current, lease, result);
      },
      now,
    );
  renew: OperationRepository["renew"] = async (
    workspaceId,
    kind,
    id,
    lease,
    now,
  ) => {
    const next = await mutate(
      this.connection,
      workspaceId,
      kind,
      id,
      (current, session) => {
        assertLease(current, lease);
        const cancelled =
          current.cancelRequested ||
          (session.state === "ended" && !current.snapshot?.allowEnded);
        if (
          cancelled ||
          current.expiresAt <= now ||
          !["running", "unknown"].includes(current.state)
        )
          return { ...current, cancelRequested: true };
        return { ...current, state: "running", leaseUntil: now + 90_000 };
      },
    );
    return !next.cancelRequested && next.state === "running";
  };
  cancel: OperationRepository["cancel"] = async (
    workspaceId,
    conversationId,
  ) => {
    this.connection.database
      .update(operations)
      .set({ cancelRequested: true })
      .where(
        and(
          eq(operations.workspaceId, workspaceId),
          eq(operations.conversationId, conversationId),
          inArray(operations.state, ["prepared", "running"]),
        ),
      )
      .run();
  };
  recover: OperationRepository["recover"] = (now) =>
    recover(this.connection, now);
}
