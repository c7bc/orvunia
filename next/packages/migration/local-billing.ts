import type { SqliteConnection } from "../storage/sqlite/connection.ts";
import { billingAccounts } from "../storage/sqlite/billing-schema.ts";
import type { BillingProjection } from "./billing.ts";
export function writeLocalBilling(
  connection: SqliteConnection,
  projection: BillingProjection,
) {
  for (const account of projection.accounts)
    connection.database.insert(billingAccounts).values(account).run();
  for (const payment of projection.payments)
    connection.client
      .query(
        "INSERT INTO next_payments(workspace_id,revision,data) VALUES(?,?,?)",
      )
      .run(payment.workspaceId, payment.revision, JSON.stringify(payment));
  for (const event of projection.events)
    connection.client
      .query(
        "INSERT INTO next_billing_events(id,subscription_id,created_at,state,token,lease_until,retry_at,attempts) VALUES(?,NULL,?,'completed',NULL,0,0,0)",
      )
      .run(event.id, event.createdAt);
}
