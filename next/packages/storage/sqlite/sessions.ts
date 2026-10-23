import { resumeSession } from "./session-resume.ts";
import { foldSearch } from "../../search/fold.ts";
import { assertSessionChange } from "../../sessions/changes.ts";
import { removeSession } from "./session-delete.ts";
import { sessionOperationChange } from "./session-operations.ts";
import { assets } from "./asset-schema.ts";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  SessionRecord,
  SessionChange,
  StoredEntry,
} from "../../sessions/domain.ts";
import { SessionError } from "../../sessions/domain.ts";
import type { SessionRepository } from "../../sessions/repository.ts";
import type { SqliteConnection } from "./connection.ts";
import { conversations, notes } from "./schema.ts";
import { history } from "./history-schema.ts";
import { SqliteConversations } from "./conversations.ts";
import { sessionHistory } from "./session-history.ts";
import { legacySegment } from "./legacy-read.ts";

const owned = (workspaceId: string, id: string) =>
  and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, id));
export class SqliteSessions implements SessionRepository {
  legacySegment: SessionRepository["legacySegment"] = (...args) =>
    legacySegment(this.connection, ...args);
  private readonly conversations;
  private readonly history;
  constructor(private readonly connection: SqliteConnection) {
    this.conversations = new SqliteConversations(connection);
    this.history = sessionHistory(connection);
  }
  async find(workspaceId: string, id: string) {
    return this.conversations.find(workspaceId, id);
  }
  async list(workspaceId: string, limit: number, before?: string) {
    return this.conversations.list(workspaceId, limit, before);
  }
  latestSummary: SessionRepository["latestSummary"] = (...args) =>
    this.history.latestSummary(...args);
  entries: SessionRepository["entries"] = (...args) =>
    this.history.entries(...args);
  entry: SessionRepository["entry"] = (...args) => this.history.entry(...args);
  counts: SessionRepository["counts"] = (...args) =>
    this.history.counts(...args);
  async create(session: SessionRecord) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;

        database
          .insert(conversations)
          .values({ ...session, searchTitle: foldSearch(session.title) })
          .run();
        database
          .insert(notes)
          .values({ conversationId: session.id, text: "", revision: 0 })
          .run();
        return session;
      })
      .immediate();
  }
  async change(
    workspaceId: string,
    id: string,
    decide: (session: SessionRecord) => SessionChange,
  ) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const current = database
          .select()
          .from(conversations)
          .where(owned(workspaceId, id))
          .get();
        if (!current) throw new SessionError("conversation_not_found");
        const change = decide(structuredClone(current));
        assertSessionChange(current, change);
        sessionOperationChange(
          database,
          workspaceId,
          id,
          change,
          current.state,
        );
        const next = { ...change.next, revision: current.revision + 1 };
        database
          .update(conversations)
          .set({ ...next, searchTitle: foldSearch(next.title) })
          .where(owned(workspaceId, id))
          .run();
        if (change.clear === "captures")
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
        if (change.clear)
          database
            .delete(history)
            .where(
              and(
                eq(history.conversationId, id),
                eq(history.kind, change.clear),
              ),
            )
            .run();
        if (change.remove)
          database
            .delete(history)
            .where(
              and(
                eq(history.conversationId, id),
                eq(history.id, change.remove),
              ),
            )
            .run();
        let appended: StoredEntry | undefined;
        if (change.append) {
          const entry = change.append;
          const existing = database
            .select()
            .from(history)
            .where(
              and(
                eq(history.conversationId, id),
                eq(history.kind, entry.kind),
                entry.segmentId
                  ? eq(history.segmentId, entry.segmentId)
                  : eq(history.id, entry.id),
              ),
            )
            .get();
          if (existing) appended = existing as StoredEntry;
          else
            appended = database
              .insert(history)
              .values({
                ...entry,
                searchText:
                  entry.kind === "captures" ? "" : foldSearch(entry.data.text),
              })
              .returning()
              .get() as StoredEntry;
        }
        return { session: next, ...(appended ? { appended } : {}) };
      })
      .immediate();
  }
  resume: SessionRepository["resume"] = (...args) =>
    resumeSession(this.connection, ...args);
  remove: SessionRepository["remove"] = (...args) =>
    removeSession(this.connection, ...args);
}
