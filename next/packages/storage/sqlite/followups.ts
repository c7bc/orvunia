import { queueFollowup } from "./followup-queue.ts";
import { and, eq, desc } from "drizzle-orm";
import type { FollowupRepository } from "../../followups/repository.ts";
import { saveDraft, FollowupError } from "../../followups/domain.ts";
import type { DraftInput, Delivery } from "../../followups/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { drafts, deliveries, requests } from "./followup-schema.ts";
import { conversations } from "./schema.ts";
const owned = (workspaceId: string, conversationId: string) =>
  and(
    eq(drafts.workspaceId, workspaceId),
    eq(drafts.conversationId, conversationId),
  );
export class SqliteFollowups implements FollowupRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async draft(workspaceId: string, conversationId: string) {
    const row = this.connection.database
      .select()
      .from(drafts)
      .where(owned(workspaceId, conversationId))
      .get();
    return row ?? null;
  }
  async save(
    workspaceId: string,
    conversationId: string,
    input: DraftInput,
    updatedAt: string,
  ) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        if (
          !database
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.id, conversationId),
                eq(conversations.workspaceId, workspaceId),
              ),
            )
            .get()
        )
          throw new FollowupError("conversation_not_found", 404);
        const current =
          database
            .select()
            .from(drafts)
            .where(owned(workspaceId, conversationId))
            .get() ?? null;
        const draft = saveDraft(current, input, updatedAt);
        database
          .insert(drafts)
          .values({ ...draft, workspaceId, conversationId })
          .onConflictDoUpdate({
            target: [drafts.workspaceId, drafts.conversationId],
            set: draft,
          })
          .run();
        return draft;
      })
      .immediate();
  }
  async receipt(workspaceId: string, requestId: string) {
    return (
      this.connection.database
        .select({ delivery: deliveries })
        .from(requests)
        .innerJoin(deliveries, eq(deliveries.id, requests.deliveryId))
        .where(
          and(
            eq(requests.workspaceId, workspaceId),
            eq(requests.requestId, requestId),
          ),
        )
        .get()?.delivery ?? null
    );
  }
  async latest(workspaceId: string, conversationId: string) {
    return (
      this.connection.database
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.workspaceId, workspaceId),
            eq(deliveries.conversationId, conversationId),
          ),
        )
        .orderBy(desc(deliveries.revision))
        .get() ?? null
    );
  }
  queue(candidate: Delivery, dailyLimit: number) {
    return queueFollowup(this.connection, candidate, dailyLimit);
  }
}
