import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import type { Asset } from "../../assets/domain.ts";
export const assets = sqliteTable("next_assets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  requestKey: text("request_key").notNull(),
  objectKey: text("object_key").notNull(),
  hash: text("hash").notNull(),
  bytes: integer("bytes").notNull(),
  mime: text("mime").notNull(),
  title: text("title").notNull(),
  time: text("time").notNull(),
  state: text("state").$type<Asset["state"]>().notNull(),
  createdAt: integer("created_at").notNull(),
});
