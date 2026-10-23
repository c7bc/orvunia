import { foldSearch } from "../../search/fold.ts";
import { usageSettlements } from "./settlement-schema.ts";
import { completedCharge } from "../../operations/measurement.ts";
import { eq } from "drizzle-orm";
import type { Operation } from "../../operations/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { history } from "./history-schema.ts";
import { conversations } from "./schema.ts";
export function persistCompletion(
  database: SqliteConnection["database"],
  current: Operation,
  next: Operation,
  now?: string,
) {
  if (next.state !== "completed" || current.state === "completed") return;
  if (!next.result || !next.snapshot || !now)
    throw Error("Operation completion requires its result and snapshot");
  if (next.reservationId) {
    database
      .insert(usageSettlements)
      .values({
        reservationId: next.reservationId,
        workspaceId: next.workspaceId,
        actual: completedCharge(next, next.result).actual,
        measurement: completedCharge(next, next.result).measurement,
      })
      .run();
  }
  if (next.snapshot.metadata.publish === false) return;
  const result = next.result,
    metadata = next.snapshot.metadata;
  if (next.kind === "transcription") {
    if (!result.empty)
      database
        .insert(history)
        .values({
          id: result.id,
          conversationId: next.conversationId,
          kind: "transcripts",
          searchText: foldSearch(result.text),
          segmentId: metadata.segmentId ?? next.id,
          data: {
            id: result.id,
            text: result.text,
            who: metadata.who ?? "Interlocutor",
            time: metadata.time ?? "00:00",
            source: "audio",
            segmentId: metadata.segmentId ?? next.id,
          },
        })
        .run();
  } else {
    database
      .insert(history)
      .values({
        id: result.id,
        conversationId: next.conversationId,
        kind: "responses",
        searchText: foldSearch(result.text),
        segmentId: null,
        data: {
          id: result.id,
          text: result.text,
          action: metadata.action,
          mode: metadata.mode,
          model: result.model,
          date: now,
          question: metadata.question,
          captureIds: result.captureIds,
          ...(metadata.sourceTranscriptIds ? { sourceTranscriptIds: [...metadata.sourceTranscriptIds] } : {}),
        },
      })
      .run();
    database
      .update(conversations)
      .set({ question: metadata.question, mode: metadata.mode })
      .where(eq(conversations.id, next.conversationId))
      .run();
  }
}
