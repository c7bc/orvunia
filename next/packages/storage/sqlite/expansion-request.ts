import { and, eq } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import type { ExpansionStage } from "../../expansions/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import { expansions } from "./expansion-schema.ts";
import { operations } from "./operation-schema.ts";
import { history } from "./history-schema.ts";

export function assertExpansionRequest(
  database: SqliteConnection["database"],
  stage: ExpansionStage,
) {
  const existing = database
    .select()
    .from(expansions)
    .where(
      and(
        eq(expansions.workspaceId, stage.workspaceId),
        eq(expansions.sourceId, stage.sourceId),
      ),
    )
    .get();
  if (existing) return;
  const saved = database
    .select({ id: history.id })
    .from(history)
    .where(and(eq(history.kind, "responses"), eq(history.id, stage.requestId)))
    .get();
  const operation = database
    .select({ id: operations.id })
    .from(operations)
    .where(eq(operations.id, stage.requestId))
    .get();
  if (saved || operation) throw new OperationError("request_conflict");
}
