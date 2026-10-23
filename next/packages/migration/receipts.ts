import { createHash } from "node:crypto";
import { z } from "zod";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import type { LegacyUpload } from "../assets/domain.ts";
import type { LegacySegment } from "../sessions/domain.ts";
export type ReceiptProjection = {
  uploads: (LegacyUpload & { workspaceId: string; requestKey: string })[];
  segments: {
    workspaceId: string;
    conversationId: string;
    segmentId: string;
    result: LegacySegment;
  }[];
};
const upload = z.object({
  owner: z.uuid(),
  request_key: z.uuid(),
  session: z.uuid(),
  capture_id: z.uuid(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  result: z.string(),
});
const captureResult = z.object({
  id: z.uuid(),
  title: z.string(),
  time: z.string(),
  url: z.string(),
});
export function projectReceipts(
  reader: LegacyReader,
  projection: LegacyProjection,
): ReceiptProjection {
  const sessions = new Map(
    projection.sessions.map((value) => [value.id, value.workspaceId]),
  );
  const receipts: ReceiptProjection = { uploads: [], segments: [] };
  for (const row of reader.rows("capture_uploads")) {
    const value = upload.parse(row),
      result = captureResult.parse(JSON.parse(value.result));
    if (
      sessions.get(value.session) !== value.owner ||
      result.id !== value.capture_id ||
      result.url !==
        `/api/sessions/${value.session}/captures/${value.capture_id}`
    )
      throw Error("Legacy capture receipt has inconsistent ownership");
    const image = projection.images.find(
      (item) => item.asset.id === value.capture_id,
    );
    if (
      image &&
      (image.asset.conversationId !== value.session ||
        result.title !== image.asset.title ||
        result.time !== image.asset.time ||
        createHash("sha256")
          .update(image.asset.mime)
          .update("\0")
          .update(image.data)
          .digest("hex") !== value.payload_hash)
    )
      throw Error("Legacy capture receipt fingerprint mismatch");
    receipts.uploads.push({
      workspaceId: value.owner,
      requestKey: value.request_key,
      conversationId: value.session,
      captureId: value.capture_id,
      hash: value.payload_hash,
    });
  }
  const segments = new Set<string>();
  for (const entry of projection.entries) {
    if (entry.kind !== "transcripts" || !entry.segmentId) continue;
    const workspaceId = sessions.get(entry.conversationId);
    if (!workspaceId) throw Error("Legacy transcript has no owning workspace");
    const key = `${entry.conversationId}:${entry.segmentId}`;
    if (segments.has(key))
      throw Error("Legacy transcript segment is duplicated");
    segments.add(key);
    receipts.segments.push({
      workspaceId,
      conversationId: entry.conversationId,
      segmentId: entry.segmentId,
      result: entry.data,
    });
  }
  for (const row of reader.rows("empty_transcriptions")) {
    const conversationId = z.uuid().parse(row.session),
      segmentId = z.uuid().parse(row.segment_id),
      workspaceId = sessions.get(conversationId);
    if (!workspaceId)
      throw Error("Legacy empty transcription has no owning workspace");
    if (segments.has(`${conversationId}:${segmentId}`)) continue;
    segments.add(`${conversationId}:${segmentId}`);
    receipts.segments.push({
      workspaceId,
      conversationId,
      segmentId,
      result: { text: "", empty: true },
    });
  }
  return receipts;
}
