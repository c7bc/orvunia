import { and, eq, gte, count } from "drizzle-orm";
import { FollowupError } from "../../followups/domain.ts";
import type { Delivery } from "../../followups/domain.ts";
import { decideDelivery } from "../../followups/decisions.ts";
import type { SqliteConnection } from "./connection.ts";
import {
  drafts,
  deliveries,
  mailAttempts,
  requests,
} from "./followup-schema.ts";
import { conversations } from "./schema.ts";
const owned = (workspaceId: string, conversationId: string) =>
  and(
    eq(drafts.workspaceId, workspaceId),
    eq(drafts.conversationId, conversationId),
  );
export async function queueFollowup(
  connection: SqliteConnection,
  candidate: Delivery,
  dailyLimit: number,
) {
  return connection.client
    .transaction(() => {
      const database = connection.database;
      const { workspaceId, conversationId, requestId, revision } = candidate;
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
      const request =
        database
          .select({ delivery: deliveries })
          .from(requests)
          .innerJoin(deliveries, eq(deliveries.id, requests.deliveryId))
          .where(
            and(
              eq(requests.workspaceId, workspaceId),
              eq(requests.requestId, requestId),
            ),
          )
          .get()?.delivery ?? null;
      const previous =
        database
          .select()
          .from(deliveries)
          .where(
            and(
              eq(deliveries.workspaceId, workspaceId),
              eq(deliveries.conversationId, conversationId),
              eq(deliveries.revision, revision),
            ),
          )
          .get() ?? null;
      const draft =
        database
          .select()
          .from(drafts)
          .where(owned(workspaceId, conversationId))
          .get() ?? null;
      const used = database
        .select({ value: count() })
        .from(mailAttempts)
        .where(
          and(
            eq(mailAttempts.workspaceId, workspaceId),
            gte(mailAttempts.createdAt, candidate.createdAt - 86_400_000),
          ),
        )
        .get()!.value;
      const result = decideDelivery(candidate, {
        request,
        previous,
        draft,
        used,
        dailyLimit,
      });
      if (!result.repeated) {
        database.insert(deliveries).values(candidate).run();
        database
          .insert(mailAttempts)
          .values({
            id: candidate.id,
            workspaceId,
            createdAt: candidate.createdAt,
          })
          .run();
      }
      database
        .insert(requests)
        .values({ workspaceId, requestId, deliveryId: result.delivery.id })
        .onConflictDoNothing()
        .run();
      return result;
    })
    .immediate();
}
