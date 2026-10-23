import { foldSearch } from "../../search/fold.ts";
import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import type {
  Conversation,
  Notes,
  NotesUpdate,
} from "../../conversations/domain.ts";
import { ConversationError } from "../../conversations/domain.ts";
import { updatedNotes } from "../../conversations/notes.ts";
import type { ConversationRepository } from "../../conversations/repository.ts";
import type { SqliteConnection } from "./connection.ts";
import { conversations, notes } from "./schema.ts";

export class SqliteConversations implements ConversationRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async insert(conversation: Conversation) {
    return this.connection.database.transaction((transaction) => {
      transaction
        .insert(conversations)
        .values({
          ...conversation,
          searchTitle: foldSearch(conversation.title),
        })
        .run();
      transaction
        .insert(notes)
        .values({ conversationId: conversation.id, text: "", revision: 0 })
        .run();
      return conversation;
    });
  }
  async find(workspaceId: string, id: string) {
    return (
      this.connection.database
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            eq(conversations.id, id),
          ),
        )
        .get() ?? null
    );
  }
  async list(workspaceId: string, limit: number, before?: string) {
    const anchor = before ? await this.find(workspaceId, before) : null;
    if (before && !anchor)
      throw new ConversationError("conversation_not_found");
    return this.connection.database
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          anchor
            ? or(
                lt(conversations.createdAt, anchor.createdAt),
                and(
                  eq(conversations.createdAt, anchor.createdAt),
                  lt(conversations.id, anchor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(conversations.createdAt), desc(conversations.id))
      .limit(limit)
      .all();
  }
  async end(workspaceId: string, id: string) {
    return (
      this.connection.database
        .update(conversations)
        .set({ state: "ended" })
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            eq(conversations.id, id),
          ),
        )
        .returning()
        .get() ?? null
    );
  }
  async notes(workspaceId: string, id: string): Promise<Notes> {
    const result = this.connection.database
      .select({
        text: notes.text,
        revision: notes.revision,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .innerJoin(conversations, eq(notes.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, id),
        ),
      )
      .get();
    if (!result) throw new ConversationError("conversation_not_found");
    return result;
  }
  async exportNotes(workspaceId: string) {
    return this.connection.database
      .select({
        session: notes.conversationId,
        text: notes.text,
        revision: notes.revision,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .innerJoin(conversations, eq(notes.conversationId, conversations.id))
      .where(eq(conversations.workspaceId, workspaceId))
      .orderBy(asc(conversations.createdAt), asc(conversations.id))
      .all();
  }
  async updateNotes(
    workspaceId: string,
    id: string,
    input: NotesUpdate,
    now: string,
  ) {
    return this.connection.client
      .transaction(() => {
        const owned = this.connection.database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.workspaceId, workspaceId),
              eq(conversations.id, id),
            ),
          )
          .get();
        if (!owned) throw new ConversationError("conversation_not_found");
        const current = this.connection.database
          .select()
          .from(notes)
          .where(eq(notes.conversationId, id))
          .get();
        if (!current) throw new ConversationError("conversation_not_found");
        const publicNotes = {
          text: current.text,
          revision: current.revision,
          updatedAt: current.updatedAt,
        };
        const updated = updatedNotes(publicNotes, input, now);
        if (updated === publicNotes) return updated;
        this.connection.database
          .update(notes)
          .set(updated)
          .where(eq(notes.conversationId, id))
          .run();
        return updated;
      })
      .immediate();
  }
}
