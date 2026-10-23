import { createHash } from "node:crypto";
import { z } from "zod";
import type { LegacyProjection } from "./projection.ts";
import { legacyOperation } from "./operations.ts";
export function projectAudioHolds(projection: LegacyProjection, now: number) {
  for (const reservation of projection.supplemental.reservations) {
    if (
      reservation.kind !== "transcriptionSeconds" ||
      reservation.state !== "unknown" ||
      !reservation.requestKey.startsWith("audio:")
    )
      continue;
    const parts = reservation.requestKey.split(":"),
      conversationId = z.uuid().parse(parts[1]),
      segmentId = z.uuid().parse(parts[2]);
    if (parts.length !== 3)
      throw Error("Invalid legacy audio reservation identity");
    const session = projection.sessions.find(
      (value) => value.id === conversationId,
    );
    if (!session) continue;
    if (session.workspaceId !== reservation.workspaceId)
      throw Error("Legacy audio reservation has inconsistent ownership");
    if (
      projection.receipts.segments.some(
        (value) =>
          value.conversationId === conversationId &&
          value.segmentId === segmentId,
      )
    )
      continue;
    const id = createHash("sha256")
      .update(`${conversationId}:${segmentId}`)
      .digest("hex");
    projection.operations.push({
      ...legacyOperation(id, session.workspaceId, conversationId, now),
      kind: "transcription",
      state: "unknown",
      reservationId: reservation.id,
    });
  }
}
