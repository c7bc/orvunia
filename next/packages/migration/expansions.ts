import { createHash } from "node:crypto";
import { z } from "zod";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import { legacyOperation } from "./operations.ts";
const stageSchema = z.object({
  owner: z.uuid(),
  session: z.uuid(),
  source: z.uuid(),
  request_id: z.uuid(),
  status: z.enum(["generating", "ready", "failed", "revealed", "expired"]),
  expires: z.number().int().nonnegative(),
  text: z.string().nullable(),
  model: z.string().nullable(),
  context_source: z.enum(["original-snapshot", "saved-answer-only"]),
  cancelled: z.union([z.literal(0), z.literal(1)]),
});
export function projectExpansions(
  reader: LegacyReader,
  projection: LegacyProjection,
  now: number,
) {
  for (const row of reader.rows("tell_me_more")) {
    const stage = stageSchema.parse(row),
      session = projection.sessions.find(
        (value) =>
          value.id === stage.session && value.workspaceId === stage.owner,
      ),
      source = projection.entries.find(
        (value) =>
          value.kind === "responses" &&
          value.id === stage.source &&
          value.conversationId === stage.session,
      );
    if (!session || !source || stage.source === stage.request_id)
      throw Error("Legacy expansion has inconsistent ownership");
    let operation = projection.operations.find(
      (value) => value.id === stage.request_id && value.kind === "expansion",
    );
    if (!operation) {
      operation = legacyOperation(
        stage.request_id,
        stage.owner,
        stage.session,
        Math.max(0, stage.expires - 86400000),
      );
      operation.kind = "expansion";
      operation.requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            source: stage.source,
            requestId: stage.request_id,
            kind: "tell-me-more",
          }),
        )
        .digest("hex");
      operation.expiresAt = stage.expires;
      operation.state = stage.expires <= now ? "expired" : "unknown";
      projection.operations.push(operation);
    }
    if (
      operation.workspaceId !== stage.owner ||
      operation.conversationId !== stage.session
    )
      throw Error("Legacy expansion operation identity mismatch");
    if (stage.status === "ready" && stage.expires > now) {
      if (stage.text === null || stage.model === null || !operation.snapshot)
        throw Error("Legacy prepared expansion is missing its frozen context");
      operation.result = {
        id: stage.request_id,
        text: stage.text,
        model: stage.model,
        captureIds: operation.snapshot.images.map((image) => image.id),
      };
      operation.state = "completed";
    }
    if (operation.snapshot) operation.snapshot.metadata.publish = false;
    operation.snapshotBytes = operation.snapshot
      ? Buffer.byteLength(JSON.stringify(operation.snapshot)) +
        operation.snapshot.images.reduce((sum, image) => sum + image.bytes, 0)
      : 0;
    projection.expansions.push({
      sourceId: stage.source,
      workspaceId: stage.owner,
      conversationId: stage.session,
      requestId: stage.request_id,
      expiresAt: stage.expires,
      revealed: stage.status === "revealed",
      cancelled: stage.cancelled === 1,
      contextSource: stage.context_source,
    });
  }
}
