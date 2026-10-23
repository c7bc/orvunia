import { z } from "zod";
import type { LegacyProjection } from "./projection.ts";
import type { LegacyReader } from "./reader.ts";
import type { Operation } from "../operations/domain.ts";
import { requestSnapshot } from "./request-snapshot.ts";
const request = z.object({
  id: z.uuid(),
  owner: z.uuid(),
  session: z.uuid(),
  request_hash: z.string().min(1),
  payload: z.string().nullable(),
  capture_ids: z.string(),
  created: z.number().int().nonnegative(),
  expires: z.number().int().nonnegative(),
  state: z.enum(["completed", "failed", "processing", "expired"]),
});
export function legacyOperation(
  id: string,
  workspaceId: string,
  conversationId: string,
  createdAt: number,
): Operation {
  if (!Number.isSafeInteger(createdAt))
    throw Error("Invalid legacy operation timestamp");
  return {
    id,
    workspaceId,
    conversationId,
    kind: "answer",
    requestHash: "legacy-unavailable",
    state: "expired",
    attempt: 1,
    snapshot: null,
    snapshotBytes: 0,
    result: null,
    lease: "",
    leaseUntil: 0,
    expiresAt: createdAt + 86400000,
    createdAt,
    cancelRequested: false,
    providerStarted: true,
    partial: false,
    reservationId: null,
  };
}
export function projectOperations(
  reader: LegacyReader,
  projection: LegacyProjection,
  runId: string,
  now: number,
) {
  const stages = new Map(
      reader.rows("tell_me_more").map((row) => [String(row.request_id), row]),
    ),
    operations = new Map<string, Operation>();
  const responses = projection.entries.filter(
    (entry) => entry.kind === "responses",
  );
  for (const row of reader.rows("responses")) {
    const source = responses.find(
        (entry) => entry.id === row.id && entry.conversationId === row.session,
      ),
      session = projection.sessions.find((item) => item.id === row.session);
    if (!source || !session)
      throw Error("Legacy response operation has inconsistent ownership");
    const operation = legacyOperation(
      source.id,
      session.workspaceId,
      session.id,
      Date.parse(source.data.date),
    );
    operation.kind = stages.has(source.id) ? "expansion" : "answer";
    operation.requestHash = String(row.request_hash || "legacy-unavailable");
    operation.state = "completed";
    operation.result = {
      id: source.id,
      text: source.data.text,
      model: source.data.model,
      captureIds: [],
    };
    operations.set(`${operation.kind}:${operation.id}`, operation);
  }
  const handled = new Set<string>();
  if (reader.columns("answer_requests").has("owner")) {
    handled.add("answer_requests");
    handled.add("answer_request_images");
    for (const row of reader.rows("answer_requests")) {
      const value = request.parse(row),
        kind = stages.has(value.id) ? "expansion" : "answer",
        key = `${kind}:${value.id}`,
        completed = operations.get(key),
        session = projection.sessions.find(
          (item) =>
            item.id === value.session && item.workspaceId === value.owner,
        );
      if (!session)
        throw Error("Legacy request operation has inconsistent ownership");
      const operation =
        completed ??
        legacyOperation(value.id, value.owner, value.session, value.created);
      if (
        completed &&
        kind === "answer" &&
        completed.requestHash !== "legacy-unavailable" &&
        completed.requestHash !== value.request_hash
      )
        throw Error("Legacy saved response fingerprint mismatch");
      if (
        operation.conversationId !== value.session ||
        operation.workspaceId !== value.owner
      )
        throw Error("Legacy request operation identity mismatch");
      operation.kind = kind;
      operation.requestHash = value.request_hash;
      operation.expiresAt = value.expires;
      operation.createdAt = value.created;
      const captures = z
        .array(z.uuid())
        .max(3)
        .parse(JSON.parse(value.capture_ids));
      if (operation.result) {
        operation.result.captureIds = captures;
        const source = responses.find(
          (entry) =>
            entry.id === value.id && entry.conversationId === value.session,
        );
        if (source) source.data.captureIds = captures;
      } else
        operation.state =
          value.expires <= now ||
          value.state === "expired" ||
          value.state === "completed"
            ? "expired"
            : "unknown";
      if (value.payload !== null && value.expires > now)
        operation.snapshot = requestSnapshot(
          reader,
          projection,
          { ...value, payload: value.payload },
          runId,
          kind === "expansion",
        );
      if (
        operation.snapshot &&
        JSON.stringify(operation.snapshot.images.map((image) => image.id)) !==
          JSON.stringify(captures)
      )
        throw Error("Legacy request capture identities mismatch");
      operation.snapshotBytes = operation.snapshot
        ? Buffer.byteLength(JSON.stringify(operation.snapshot)) +
          operation.snapshot.images.reduce((sum, image) => sum + image.bytes, 0)
        : 0;
      operations.set(key, operation);
    }
  }
  projection.operations = [...operations.values()];
  return handled;
}
