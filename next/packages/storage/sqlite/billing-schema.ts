import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const billingAccounts = sqliteTable("next_billing_accounts", {
  workspaceId: text("workspace_id").primaryKey(),
  planId: text("plan_id").notNull().default("free"),
  status: text("status").notNull().default("none"),
  periodEnd: integer("period_end").notNull().default(0),
  customerId: text("customer_id"),
  subscriptionId: text("subscription_id"),
});
