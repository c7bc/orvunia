import { createHash } from "node:crypto";
import type { RealtimeDependencies } from "./dependencies.ts";
import type { Ticket } from "./domain.ts";
import { RealtimeError } from "./domain.ts";
import { normalizeTranscriptionText } from "../transcription/text.ts";
export async function persistTranscript(
  dependencies: RealtimeDependencies,
  ticket: Ticket,
  item: string,
  text: string,
  time: string,
  utteranceId?: string,
) {
  const normalized = normalizeTranscriptionText(text);
  const transcript = normalized
    ? {
        id: dependencies.identifier(),
        text: normalized,
        who: ticket.who,
        time,
        source: "audio" as const,
        ...(utteranceId ? { utteranceId } : {}),
        segmentId: createHash("sha256")
          .update(`${ticket.id}:${item}`)
          .digest("hex"),
      }
    : null;
  const result = await dependencies.sessions.change(
    ticket.workspaceId,
    ticket.sessionId,
    (session) => {
      if (
        session.state !== "active" ||
        session.historyGeneration !== ticket.historyGeneration
      )
        throw new RealtimeError("realtime_closed");
      return {
        next: session,
        ...(transcript
          ? {
              append: {
                id: transcript.id,
                conversationId: session.id,
                kind: "transcripts" as const,
                segmentId: transcript.segmentId,
                data: transcript,
              },
            }
          : {}),
      };
    },
  );
  return result.appended?.kind === "transcripts" ? result.appended.data : null;
}
