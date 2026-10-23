import type { SqliteConnection } from "../storage/sqlite/connection.ts";
import type { SupplementalProjection } from "./supplemental.ts";
import {
  drafts,
  deliveries,
  mailAttempts,
  requests,
} from "../storage/sqlite/followup-schema.ts";
import { usage } from "../storage/sqlite/usage-schema.ts";
export function writeLocalSupplemental(
  connection: SqliteConnection,
  projection: SupplementalProjection,
) {
  const database = connection.database;
  for (const draft of projection.drafts)
    database.insert(drafts).values(draft).run();
  for (const delivery of projection.deliveries) {
    database.insert(deliveries).values(delivery).run();
    database
      .insert(mailAttempts)
      .values({
        id: delivery.id,
        workspaceId: delivery.workspaceId,
        createdAt: delivery.createdAt,
      })
      .run();
    database
      .insert(requests)
      .values({
        workspaceId: delivery.workspaceId,
        requestId: delivery.requestId,
        deliveryId: delivery.id,
      })
      .run();
  }
  for (const reservation of projection.reservations)
    database.insert(usage).values(reservation).run();
}
