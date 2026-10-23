import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { HistoryKind, StoredEntryOf } from "../../sessions/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";

export function sessionHistory(connection: SqliteConnection) {
  const owned = (workspaceId: string, id: string) =>
    and(
      eq(conversations.workspaceId, workspaceId),
      eq(history.conversationId, id),
    );
  return {
    async latestSummary(workspaceId: string, id: string) {
      const rows = connection.database
        .select({ data: history.data })
        .from(history)
        .innerJoin(conversations, eq(history.conversationId, conversations.id))
        .where(
          and(
            owned(workspaceId, id),
            eq(history.kind, "responses"),
            sql`json_extract(${history.data}, '$.action') = 'recap'`,
          ),
        )
        .orderBy(desc(history.position))
        .get();
      return (
        (rows?.data as import("../../sessions/domain.ts").Answer | undefined) ??
        null
      );
    },
    async entries<Kind extends HistoryKind>(
      workspaceId: string,
      id: string,
      kind: Kind,
      options: { limit: number; before?: number; after?: number },
    ) {
      const rows = connection.database
        .select({ entry: history })
        .from(history)
        .innerJoin(conversations, eq(history.conversationId, conversations.id))
        .where(
          and(
            owned(workspaceId, id),
            eq(history.kind, kind),
            options.before !== undefined
              ? lt(history.position, options.before)
              : undefined,
            options.after !== undefined
              ? gt(history.position, options.after)
              : undefined,
          ),
        )
        .orderBy(
          options.after !== undefined
            ? asc(history.position)
            : desc(history.position),
        )
        .limit(options.limit)
        .all();
      const values = rows.map((row) => {
        const { searchText: projection, ...entry } = row.entry;
        return entry as StoredEntryOf<Kind>;
      });
      return options.after !== undefined ? values : values.reverse();
    },
    async entry<Kind extends HistoryKind>(
      workspaceId: string,
      id: string,
      entryId: string,
      kind: Kind,
    ) {
      const rows = connection.database
        .select({ entry: history })
        .from(history)
        .innerJoin(conversations, eq(history.conversationId, conversations.id))
        .where(
          and(
            owned(workspaceId, id),
            eq(history.id, entryId),
            eq(history.kind, kind),
          ),
        )
        .get();
      return (rows?.entry as StoredEntryOf<Kind> | undefined) ?? null;
    },
    async counts(workspaceId: string, id: string) {
      const rows = connection.database
        .select({ kind: history.kind, count: sql<number>`count(*)` })
        .from(history)
        .innerJoin(conversations, eq(history.conversationId, conversations.id))
        .where(owned(workspaceId, id))
        .groupBy(history.kind)
        .all();
      const result = { transcripts: 0, responses: 0, captures: 0 };
      for (const row of rows) result[row.kind] = Number(row.count);
      return result;
    },
  };
}
