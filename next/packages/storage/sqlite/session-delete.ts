import { and, eq, inArray } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import { assets } from "./asset-schema.ts";
import { conversations } from "./schema.ts";
import { assertSessionIdle } from "./session-operations.ts";
import { deliveries } from "./followup-schema.ts";
import { OperationError } from "../../operations/domain.ts";
import { removeRepositoryAgentJobs } from "./repository-agent-privacy.ts";
const owned = (workspaceId: string, id: string) =>
  and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, id));
export async function removeSession(
  connection: SqliteConnection,
  workspaceId: string,
  id: string,
) {
  return connection.client
    .transaction(() => {
      const database = connection.database;
      assertSessionIdle(database, workspaceId, id);
      if (
        database
          .select({ id: deliveries.id })
          .from(deliveries)
          .where(
            and(
              eq(deliveries.workspaceId, workspaceId),
              eq(deliveries.conversationId, id),
              eq(deliveries.state, "processing"),
            ),
          )
          .get()
      )
        throw new OperationError("operation_busy");

      database
        .update(assets)
        .set({ state: "deleting" })
        .where(
          and(
            eq(assets.workspaceId, workspaceId),
            eq(assets.conversationId, id),
            inArray(assets.state, ["staged", "ready"]),
          ),
        )
        .run();
      removeRepositoryAgentJobs(database, workspaceId, id);
      const deleted = database
        .delete(conversations)
        .where(owned(workspaceId, id))
        .returning({ id: conversations.id })
        .get();
      return Boolean(deleted);
    })
    .immediate();
}
