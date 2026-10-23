import { assertImages } from "./operation-images.ts";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Operation } from "../../operations/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import { claimOperation } from "../../operations/decisions.ts";
import type { SqliteConnection } from "./connection.ts";
import { operations, assetReferences } from "./operation-schema.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";
import { uniqueViolation } from "../conflicts.ts";
export async function claim(connection: SqliteConnection, incoming: Operation) {
  const candidate = {
    ...incoming,
    snapshotBytes: incoming.snapshot
      ? Buffer.byteLength(JSON.stringify(incoming.snapshot)) +
        incoming.snapshot.images.reduce((sum, image) => sum + image.bytes, 0)
      : 0,
  };
  try {
    return connection.client
      .transaction(() => {
        const database = connection.database;

        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.workspaceId, candidate.workspaceId),
              eq(conversations.id, candidate.conversationId),
            ),
          )
          .get();
        const existing =
          database
            .select()
            .from(operations)
            .where(
              and(
                eq(operations.kind, candidate.kind),
                eq(operations.id, candidate.id),
              ),
            )
            .get() ?? null;
        const active = database
          .select({ count: sql<number>`count(*)` })
          .from(operations)
          .where(
            and(
              eq(operations.workspaceId, candidate.workspaceId),
              inArray(operations.state, ["prepared", "running"]),
              gt(operations.leaseUntil, candidate.createdAt),
              inArray(
                operations.kind,
                candidate.kind === "transcription"
                  ? ["transcription"]
                  : ["answer", "expansion", "followup"],
              ),
            ),
          )
          .get();
        const retained = database
          .select({
            bytes: sql<number>`coalesce(sum(${operations.snapshotBytes}),0)`,
          })
          .from(operations)
          .where(
            and(
              eq(operations.workspaceId, candidate.workspaceId),
              gt(operations.expiresAt, candidate.createdAt),
            ),
          )
          .get();
        const next = claimOperation(candidate, {
          existing,
          session,
          activeCount: Number(active?.count ?? 0),
          retainedBytes: Number(retained?.bytes ?? 0),
        });
        if (next.state === "completed") return next;
        if (!existing) {
          const saved = database
            .select()
            .from(history)
            .where(
              and(eq(history.kind, "responses"), eq(history.id, candidate.id)),
            )
            .get();
          if (candidate.kind !== "transcription" && saved)
            throw new OperationError("request_conflict");
          assertImages(database, candidate);
          database.insert(operations).values(next).run();
          for (const image of next.snapshot?.images ?? [])
            database
              .insert(assetReferences)
              .values({
                operationKind: next.kind,
                operationId: next.id,
                assetId: image.id,
                expiresAt: next.expiresAt,
              })
              .run();
        } else
          database
            .update(operations)
            .set(next)
            .where(
              and(eq(operations.id, next.id), eq(operations.kind, next.kind)),
            )
            .run();
        return next;
      })
      .immediate();
  } catch (error) {
    if (uniqueViolation(error)) throw new OperationError("request_conflict");
    throw error;
  }
}
