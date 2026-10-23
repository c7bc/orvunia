import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { UsageMeasurement } from "../../accounting/domain.ts";
export const usageSettlements = sqliteTable("next_usage_settlements", {
  action: text("action", { enum: ["commit", "release"] })
    .notNull()
    .default("commit"),
  reservationId: text("reservation_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  actual: integer("actual").notNull(),
  measurement: text("measurement", { mode: "json" })
    .$type<UsageMeasurement>()
    .notNull(),
});
