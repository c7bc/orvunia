import { and, eq, inArray, exists } from "drizzle-orm";
import { OperationError } from "../../operations/domain.ts";
import type { SessionChange } from "../../sessions/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { operations, assetReferences } from "./operation-schema.ts";
import { invalidateRepositoryAgentJobs, assertRepositoryAgentAppend } from "./repository-agent-privacy.ts";
export type OperationDatabase = SqliteConnection["database"];
export function assertSessionIdle(
  database: OperationDatabase,
  workspaceId: string,
  id: string,
) {
  const pending = database
    .select({ id: operations.id })
    .from(operations)
    .where(
      and(
        eq(operations.workspaceId, workspaceId),
        eq(operations.conversationId, id),
        inArray(operations.state, ["prepared", "running"]),
      ),
    )
    .get();
  if (pending) throw new OperationError("operation_busy");
}
export function sessionOperationChange(
  database: OperationDatabase,
  workspaceId: string,
  id: string,
  change: SessionChange,
  priorState: string,
) {
  assertRepositoryAgentAppend(database, workspaceId, id, change);
  if (change.clear || change.remove || (change.next.state === "ended" && priorState !== "ended"))
    invalidateRepositoryAgentJobs(database, workspaceId, id);
  if (change.clear) {
    assertSessionIdle(database, workspaceId, id);
    const kinds =
      change.clear === "responses"
        ? (["answer", "expansion", "followup"] as const)
        : change.clear === "transcripts"
          ? (["transcription"] as const)
          : [];
    if (kinds.length) {
      const matching = and(
        eq(operations.workspaceId, workspaceId),
        eq(operations.conversationId, id),
        inArray(operations.kind, kinds),
      );
      database
        .delete(assetReferences)
        .where(
          exists(
            database
              .select({ id: operations.id })
              .from(operations)
              .where(
                and(
                  matching,
                  eq(operations.id, assetReferences.operationId),
                  eq(operations.kind, assetReferences.operationKind),
                ),
              ),
          ),
        )
        .run();
      database
        .update(operations)
        .set({
          state: "expired",
          snapshot: null,
          snapshotBytes: 0,
          result: null,
        })
        .where(matching)
        .run();
    }
  }
  if (change.next.state === "ended" && priorState !== "ended")
    database
      .update(operations)
      .set({ cancelRequested: true })
      .where(
        and(
          eq(operations.workspaceId, workspaceId),
          eq(operations.conversationId, id),
          inArray(operations.state, ["prepared", "running"]),
        ),
      )
      .run();
}
