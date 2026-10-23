import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import type {
  UsageKind,
  UsageState,
  UsageMeasurement,
} from "../../accounting/domain.ts";
export const usage = sqliteTable("next_usage", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  requestKey: text("request_key").notNull(),
  kind: text("kind").$type<UsageKind>().notNull(),
  period: text("period").notNull(),
  units: integer("units").notNull(),
  actual: integer("actual").notNull(),
  state: text("state").$type<UsageState>().notNull(),
  createdAt: integer("created_at").notNull(),
  leaseUntil: integer("lease_until").notNull(),
  measurement: text("measurement", { mode: "json" })
    .$type<UsageMeasurement>()
    .notNull(),
});
