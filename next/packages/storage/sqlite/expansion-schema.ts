import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const expansions = sqliteTable("next_expansions", {
  sourceId: text("source_id").primaryKey(),
  sourceKind: text("source_kind").notNull().default("responses"),
  workspaceId: text("workspace_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  requestId: text("request_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revealed: integer("revealed", { mode: "boolean" }).notNull().default(false),
  cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
  contextSource: text("context_source", {
    enum: ["original-snapshot", "saved-answer-only"],
  }).notNull(),
});
