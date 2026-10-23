import { and, desc, eq, exists, inArray, lt, or, sql } from "drizzle-orm";
import type {
  SessionIndexRepository,
  IndexQuery,
} from "../../search/projection.ts";
import type { SqliteConnection } from "./connection.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";
export class SqliteSessionIndex implements SessionIndexRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async find(workspaceId: string, query: IndexQuery) {
    const database = this.connection.database;
    const text = (
      column: typeof history.searchText | typeof conversations.searchTitle,
    ) => sql`instr(${column}, ${query.search}) > 0`;
    return database
      .select({
        id: conversations.id,
        title: conversations.title,
        mode: conversations.mode,
        state: conversations.state,
        elapsed: conversations.elapsed,
        date: conversations.createdAt,
        modeId: sql<
          string | null
        >`json_extract(${conversations.modeSnapshot}, '$.id')`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          query.search
            ? or(
                text(conversations.searchTitle),
                exists(
                  database
                    .select({ id: history.id })
                    .from(history)
                    .where(
                      and(
                        eq(history.conversationId, conversations.id),
                        inArray(history.kind, ["responses", "transcripts"]),
                        text(history.searchText),
                      ),
                    ),
                ),
              )
            : undefined,
          query.before
            ? or(
                lt(conversations.createdAt, query.before.date),
                and(
                  eq(conversations.createdAt, query.before.date),
                  lt(conversations.id, query.before.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(conversations.createdAt), desc(conversations.id))
      .limit(query.limit)
      .all();
  }
}
