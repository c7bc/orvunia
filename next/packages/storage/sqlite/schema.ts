import type { ModeSnapshot } from "../../sessions/domain.ts";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable(
  "next_conversations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    searchTitle: text("search_title").notNull().default(""),
    mode: text("mode", { enum: ["recruiter", "technical"] }).notNull(),
    state: text("state", { enum: ["active", "paused", "ended"] }).notNull(),
    createdAt: text("created_at").notNull(),
    elapsed: integer("elapsed").notNull().default(0),
    question: text("question").notNull().default(""),
    modeSnapshot: text("mode_snapshot", { mode: "json" }).$type<ModeSnapshot>(),
    historyGeneration: integer("history_generation").notNull().default(0),
    revision: integer("revision").notNull().default(0),
  },
  (table) => [
    index("next_conversations_workspace_order").on(
      table.workspaceId,
      table.createdAt,
      table.id,
    ),
  ],
);
export const notes = sqliteTable("next_notes", {
  conversationId: text("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at"),
});
