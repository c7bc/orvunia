import { and, eq } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import type { Answer } from "../../sessions/domain.ts";
import { ExpansionError } from "../../expansions/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import { foldSearch } from "../../search/fold.ts";
import { expansions } from "./expansion-schema.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";
import { operations } from "./operation-schema.ts";
export async function revealExpansion(
  connection: SqliteConnection,
  workspaceId: string,
  sourceId: string,
  requestId: string,
  now: number,
) {
  return connection.client
    .transaction(() => {
      const database = connection.database;
      const stage = database
        .select()
        .from(expansions)
        .where(
          and(
            eq(expansions.workspaceId, workspaceId),
            eq(expansions.sourceId, sourceId),
          ),
        )
        .get();
      if (!stage || stage.requestId !== requestId)
        throw new ExpansionError("expansion_not_found");
      const saved = database
        .select()
        .from(history)
        .where(
          and(
            eq(history.conversationId, stage.conversationId),
            eq(history.id, requestId),
            eq(history.kind, "responses"),
          ),
        )
        .get();
      if (stage.revealed) {
        if (!saved) throw new ExpansionError("expansion_expired");
        return saved.data as Answer;
      }
      if (stage.expiresAt <= now) throw new ExpansionError("expansion_expired");
      const operation = database
        .select()
        .from(operations)
        .where(
          and(
            eq(operations.workspaceId, workspaceId),
            eq(operations.kind, "expansion"),
            eq(operations.id, requestId),
          ),
        )
        .get();
      if (
        !operation ||
        operation.state !== "completed" ||
        !operation.result ||
        !operation.snapshot
      )
        throw new ExpansionError("expansion_pending");
      if (saved) throw new OperationError("request_conflict");
      const result = operation.result,
        metadata = operation.snapshot.metadata;
      const answer: Answer = {
        id: requestId,
        text: result.text,
        model: result.model,
        action: "explain",
        mode: metadata.mode,
        date: new Date(now).toISOString(),
        question: metadata.question,
        captureIds: result.captureIds,
      };
      database
        .insert(history)
        .values({
          id: requestId,
          conversationId: stage.conversationId,
          kind: "responses",
          segmentId: null,
          data: answer,
          searchText: foldSearch(answer.text),
        })
        .run();
      database
        .update(expansions)
        .set({ revealed: true })
        .where(eq(expansions.sourceId, sourceId))
        .run();
      return answer;
    })
    .immediate();
}
