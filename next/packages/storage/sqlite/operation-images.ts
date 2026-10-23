import { and, eq } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import type { Operation } from "../../operations/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import { operations } from "./operation-schema.ts";
import { assets } from "./asset-schema.ts";
export function assertImages(
  database: SqliteConnection["database"],
  candidate: Operation,
) {
  const retained = candidate.snapshot?.retainedFrom;
  let source: Operation | undefined;
  if (retained) {
    source = database
      .select()
      .from(operations)
      .where(
        and(
          eq(operations.workspaceId, candidate.workspaceId),
          eq(operations.conversationId, candidate.conversationId),
          eq(operations.kind, retained.kind),
          eq(operations.id, retained.id),
        ),
      )
      .get();
    if (
      !source ||
      !source.snapshot ||
      source.state !== "completed" ||
      source.expiresAt <= candidate.createdAt
    )
      throw new OperationError("operation_expired");
  }
  for (const image of candidate.snapshot?.images ?? []) {
    const asset = database
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, image.id),
          eq(assets.workspaceId, candidate.workspaceId),
          eq(assets.conversationId, candidate.conversationId),
        ),
      )
      .get();
    const pinned = source?.snapshot?.images.some(
      (original) =>
        original.id === image.id &&
        original.hash === image.hash &&
        original.key === image.key &&
        original.bytes === image.bytes &&
        original.mime === image.mime,
    );
    if (
      !asset ||
      (asset.state !== "ready" && !pinned) ||
      asset.objectKey !== image.key ||
      asset.hash !== image.hash ||
      asset.bytes !== image.bytes ||
      asset.mime !== image.mime
    )
      throw new OperationError("asset_not_found");
  }
}
