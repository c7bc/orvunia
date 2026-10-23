import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import type { DeliveryState } from "../../followups/domain.ts";
export const drafts = sqliteTable(
  "next_followup_drafts",
  {
    workspaceId: text("workspace_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    revision: integer("revision").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.conversationId] }),
  ],
);
export const deliveries = sqliteTable("next_followup_deliveries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  revision: integer("revision").notNull(),
  requestId: text("request_id").notNull(),
  draftHash: text("draft_hash").notNull(),
  state: text("state").$type<DeliveryState>().notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: integer("created_at").notNull(),
  ciphertext: text("ciphertext").notNull(),
  expiresAt: integer("expires_at").notNull(),
  claimedAt: integer("claimed_at"),
  attempts: integer("attempts").notNull(),
  retryAt: integer("retry_at").notNull(),
});
export const mailAttempts = sqliteTable("next_followup_attempts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const requests = sqliteTable(
  "next_followup_requests",
  {
    workspaceId: text("workspace_id").notNull(),
    requestId: text("request_id").notNull(),
    deliveryId: text("delivery_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.requestId] })],
);
