import { and, eq } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import { legacySegments, legacyUploads } from "./legacy-schema.ts";
import { conversations } from "./schema.ts";
export async function legacySegment(
  connection: SqliteConnection,
  workspaceId: string,
  conversationId: string,
  segmentId: string,
) {
  return (
    connection.database
      .select({ result: legacySegments.result })
      .from(legacySegments)
      .innerJoin(
        conversations,
        eq(conversations.id, legacySegments.conversationId),
      )
      .where(
        and(
          eq(legacySegments.workspaceId, workspaceId),
          eq(conversations.workspaceId, workspaceId),
          eq(legacySegments.conversationId, conversationId),
          eq(legacySegments.segmentId, segmentId),
        ),
      )
      .get()?.result ?? null
  );
}
export async function legacyUpload(
  connection: SqliteConnection,
  workspaceId: string,
  requestKey: string,
) {
  return (
    connection.database
      .select({
        conversationId: legacyUploads.conversationId,
        captureId: legacyUploads.captureId,
        hash: legacyUploads.hash,
      })
      .from(legacyUploads)
      .innerJoin(
        conversations,
        eq(conversations.id, legacyUploads.conversationId),
      )
      .where(
        and(
          eq(legacyUploads.workspaceId, workspaceId),
          eq(conversations.workspaceId, workspaceId),
          eq(legacyUploads.requestKey, requestKey),
        ),
      )
      .get() ?? null
  );
}
