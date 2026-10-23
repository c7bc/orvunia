import { and, eq } from "drizzle-orm";
import { changeUsage } from "../../accounting/decisions.ts";
import { UsageError } from "../../accounting/domain.ts";
import type { UsageChange } from "../../accounting/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { usage } from "./usage-schema.ts";
export async function change(
  connection: SqliteConnection,
  workspaceId: string,
  id: string,
  input: UsageChange,
) {
  return connection.client
    .transaction(() => {
      const database = connection.database;
      const current = database
        .select()
        .from(usage)
        .where(and(eq(usage.workspaceId, workspaceId), eq(usage.id, id)))
        .get();
      if (!current) throw new UsageError("reservation_conflict");
      const next = changeUsage(current, input);
      database
        .update(usage)
        .set(next)
        .where(and(eq(usage.workspaceId, workspaceId), eq(usage.id, id)))
        .run();
      return next;
    })
    .immediate();
}
