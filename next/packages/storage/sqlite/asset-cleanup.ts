import { assetReferences, operations } from "./operation-schema.ts";
import { and, eq, lt, gt, asc, or, inArray, notExists } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import { assets } from "./asset-schema.ts";
export function assetCleanup(connection: SqliteConnection) {
  return {
    async garbage(stagedBefore: number, limit: number, now: number) {
      connection.database
        .update(assets)
        .set({ state: "deleting" })
        .where(
          and(eq(assets.state, "staged"), lt(assets.createdAt, stagedBefore)),
        )
        .run();
      return connection.database
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.state, "deleting"),
            notExists(
              connection.database
                .select({ id: assetReferences.assetId })
                .from(assetReferences)
                .innerJoin(
                  operations,
                  and(
                    eq(operations.id, assetReferences.operationId),
                    eq(operations.kind, assetReferences.operationKind),
                  ),
                )
                .where(
                  and(
                    eq(assetReferences.assetId, assets.id),
                    or(
                      gt(assetReferences.expiresAt, now),
                      and(
                        inArray(operations.state, ["prepared", "running"]),
                        gt(operations.leaseUntil, now),
                      ),
                    ),
                  ),
                ),
            ),
          ),
        )
        .orderBy(asc(assets.createdAt), asc(assets.id))
        .limit(limit)
        .all();
    },
    async deleted(id: string) {
      connection.database
        .update(assets)
        .set({ state: "deleted" })
        .where(and(eq(assets.id, id), eq(assets.state, "deleting")))
        .run();
    },
  };
}
