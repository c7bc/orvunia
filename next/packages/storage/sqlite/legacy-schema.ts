import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import type { LegacySegment } from "../../sessions/domain.ts";
export const legacyUploads = sqliteTable(
  "next_legacy_uploads",
  {
    workspaceId: text("workspace_id").notNull(),
    requestKey: text("request_key").notNull(),
    conversationId: text("conversation_id").notNull(),
    captureId: text("capture_id").notNull(),
    hash: text("payload_hash").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.requestKey] })],
);
export const legacySegments = sqliteTable(
  "next_legacy_segments",
  {
    workspaceId: text("workspace_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    segmentId: text("segment_id").notNull(),
    result: text("result", { mode: "json" }).$type<LegacySegment>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.conversationId, table.segmentId],
    }),
  ],
);
