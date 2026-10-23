import { and, eq, gt, lte, inArray, notExists, sql } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import { operations, assetReferences } from "./operation-schema.ts";
export async function recover(connection: SqliteConnection, now: number) {
  connection.database
    .update(operations)
    .set({
      state: sql`case when ${operations.providerStarted} then 'unknown' else 'failed' end`,
    })
    .where(
      and(
        inArray(operations.state, ["prepared", "running"]),
        lte(operations.leaseUntil, now),
      ),
    )
    .run();
  connection.database
    .update(operations)
    .set({
      snapshot: null,
      snapshotBytes: 0,
      state: sql`case when ${operations.state}='completed' and ${operations.kind}<>'expansion' then 'completed' else 'expired' end`,
      result: sql`case when ${operations.kind}='expansion' then null else ${operations.result} end`,
    })
    .where(
      and(
        lte(operations.expiresAt, now),
        sql`not (${operations.state} in ('prepared','running') and ${operations.leaseUntil} > ${now})`,
      ),
    )
    .run();
  connection.database
    .delete(assetReferences)
    .where(
      and(
        lte(assetReferences.expiresAt, now),
        notExists(
          connection.database
            .select({ id: operations.id })
            .from(operations)
            .where(
              and(
                eq(operations.id, assetReferences.operationId),
                eq(operations.kind, assetReferences.operationKind),
                inArray(operations.state, ["prepared", "running"]),
                gt(operations.leaseUntil, now),
              ),
            ),
        ),
      ),
    )
    .run();
}
