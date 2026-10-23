import { and, eq, ne, sql } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import { SessionError } from "../../sessions/domain.ts";
import { conversations } from "./schema.ts";
const owned = (workspaceId: string, id: string) =>
  and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, id));
export async function resumeSession(
  connection: SqliteConnection,
  workspaceId: string,
  id: string,
) {
  return connection.client
    .transaction(() => {
      const database = connection.database;

      const current = database
        .select()
        .from(conversations)
        .where(owned(workspaceId, id))
        .get();
      if (!current) throw new SessionError("conversation_not_found");
      const other = database
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            ne(conversations.id, id),
            ne(conversations.state, "ended"),
          ),
        )
        .get();
      if (other) throw new SessionError("session_busy");
      const next = {
        ...current,
        state: "active" as const,
        revision: current.revision + 1,
      };
      database
        .update(conversations)
        .set(next)
        .where(owned(workspaceId, id))
        .run();
      return next;
    })
    .immediate();
}
