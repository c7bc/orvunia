import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import type { HistoryKind, HistoryEntry } from "../../sessions/domain.ts";
import { conversations } from "./schema.ts";

export const history = sqliteTable("next_history", {
  position: integer("position").primaryKey({ autoIncrement: true }),
  id: text("id").notNull(),
  searchText: text("search_text").notNull().default(""),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  kind: text("kind").$type<HistoryKind>().notNull(),
  segmentId: text("segment_id"),
  data: text("data", { mode: "json" }).$type<HistoryEntry["data"]>().notNull(),
});
