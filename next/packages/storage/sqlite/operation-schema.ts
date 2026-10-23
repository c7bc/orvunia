import {
  sqliteTable,
  integer,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import type {
  OperationKind,
  OperationState,
  OperationSnapshot,
  OperationResult,
} from "../../operations/domain.ts";
export const operations = sqliteTable(
  "next_operations",
  {
    id: text("id").notNull(),
    kind: text("kind").$type<OperationKind>().notNull(),
    workspaceId: text("workspace_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    requestHash: text("request_hash").notNull(),
    state: text("state").$type<OperationState>().notNull(),
    attempt: integer("attempt").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<OperationSnapshot>(),
    snapshotBytes: integer("snapshot_bytes").notNull(),
    result: text("result", { mode: "json" }).$type<OperationResult>(),
    lease: text("lease").notNull(),
    leaseUntil: integer("lease_until").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    cancelRequested: integer("cancel_requested", { mode: "boolean" })
      .notNull()
      .default(false),
    providerStarted: integer("provider_started", { mode: "boolean" })
      .notNull()
      .default(false),
    partial: integer("partial", { mode: "boolean" }).notNull().default(false),
    reservationId: text("reservation_id"),
  },
  (table) => [primaryKey({ columns: [table.kind, table.id] })],
);
export const assetReferences = sqliteTable(
  "next_asset_references",
  {
    operationKind: text("operation_kind").$type<OperationKind>().notNull(),
    operationId: text("operation_id").notNull(),
    assetId: text("asset_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.operationKind, table.operationId, table.assetId],
    }),
  ],
);
