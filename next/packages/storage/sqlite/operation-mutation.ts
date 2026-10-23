import { persistOutcome } from "./operation-outcome.ts";
import { and, eq } from "drizzle-orm";
import type { Operation, OperationKind } from "../../operations/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { operationWhere } from "./operation-condition.ts";
import { operations } from "./operation-schema.ts";
import { conversations } from "./schema.ts";
import { persistCompletion } from "./operation-complete.ts";
import { uniqueViolation } from "../conflicts.ts";
export async function mutate(
  connection: SqliteConnection,
  workspaceId: string,
  kind: OperationKind,
  id: string,
  decide: (operation: Operation, session: { state: string }) => Operation,
  now?: string,
) {
  const initial = connection.database
    .select()
    .from(operations)
    .where(operationWhere(workspaceId, kind, id))
    .get();
  if (!initial) throw new OperationError("request_conflict");
  try {
    return connection.client
      .transaction(() => {
        const database = connection.database;
        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.workspaceId, workspaceId),
              eq(conversations.id, initial.conversationId),
            ),
          )
          .get();
        if (!session) throw new OperationError("conversation_not_found");
        const current = database
          .select()
          .from(operations)
          .where(operationWhere(workspaceId, kind, id))
          .get();
        if (!current) throw new OperationError("request_conflict");
        const next = decide(current, session);
        persistCompletion(database, current, next, now);
        persistOutcome(database, current, next);
        database
          .update(operations)
          .set(next)
          .where(operationWhere(workspaceId, kind, id))
          .run();
        return next;
      })
      .immediate();
  } catch (error) {
    if (uniqueViolation(error)) throw new OperationError("request_conflict");
    throw error;
  }
}
