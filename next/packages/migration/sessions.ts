import { z } from "zod";
import { createHash } from "node:crypto";
import type { LegacyProjection } from "./projection.ts";
import type { LegacyReader, LegacyRow } from "./reader.ts";
import { storedMode } from "./workspaces.ts";
import { transcriptInput } from "../contracts/sessions.ts";
import { definedFields } from "../contracts/defined.ts";
import { publicCapture } from "../assets/service.ts";
import { imageMime } from "../assets/images.ts";
import type { Asset } from "../assets/domain.ts";

const id = (value: unknown) => z.uuid().parse(value);
const text = (value: unknown) => z.string().parse(value);
export function projectSessions(
  reader: LegacyReader,
  projection: LegacyProjection,
  runId: string,
) {
  const owners = new Set(
    projection.workspaces.map((workspace) => workspace.id),
  );
  for (const row of reader.rows("sessions")) {
    if (!owners.has(String(row.owner)))
      throw Error("Legacy session has no owning workspace");
    projection.sessions.push({
      id: id(row.id),
      workspaceId: id(row.owner),
      title: text(row.title),
      mode: z.enum(["recruiter", "technical"]).parse(row.mode),
      state: z.enum(["active", "paused", "ended"]).parse(row.state),
      createdAt: text(row.date),
      elapsed: z.number().int().nonnegative().parse(row.elapsed),
      question: text(row.question ?? ""),
      revision: 0,
      modeSnapshot: row.mode_snapshot
        ? storedMode.parse(JSON.parse(String(row.mode_snapshot)))
        : null,
      historyGeneration:
        z
          .number()
          .int()
          .nonnegative()
          .parse(Number(row.history_generation ?? 0)) + 1,
    });
  }
  const sessionIds = new Set(projection.sessions.map((session) => session.id));
  const requireSession = (row: LegacyRow) => {
    const sessionId = id(row.session);
    if (!sessionIds.has(sessionId))
      throw Error("Legacy history has no owning session");
    return sessionId;
  };
  for (const row of reader.rows("transcripts"))
    projection.entries.push({
      id: id(row.id),
      conversationId: requireSession(row),
      kind: "transcripts",
      segmentId: row.segment ? id(row.segment) : null,
      data: {
        id: id(row.id),
        ...definedFields(
          transcriptInput.parse({
            text: row.text,
            who: row.who,
            time: row.time,
            source: row.source,
            ...(row.segment ? { segmentId: id(row.segment) } : {}),
          }),
        ),
      },
    });
  for (const row of reader.rows("responses"))
    projection.entries.push({
      id: id(row.id),
      conversationId: requireSession(row),
      kind: "responses",
      segmentId: null,
      data: {
        id: id(row.id),
        action: text(row.action),
        mode: text(row.mode),
        model: text(row.model),
        text: text(row.text),
        date: text(row.date),
        question: text(row.question ?? ""),
      },
    });
  for (const row of reader.rows("session_notes"))
    projection.notes.push({
      conversationId: requireSession(row),
      value: {
        text: text(row.text),
        revision: z.number().int().nonnegative().parse(row.revision),
        updatedAt: text(row.updated_at),
      },
    });
  for (const row of reader.rows("captures")) {
    const conversationId = requireSession(row),
      session = projection.sessions.find(
        (value) => value.id === conversationId,
      );
    if (!session || !(row.data instanceof Uint8Array))
      throw Error("Invalid legacy capture");
    const mime = imageMime(row.data);
    if (mime !== row.mime)
      throw Error("Legacy capture MIME does not match its signature");
    const asset: Asset = {
      id: id(row.id),
      workspaceId: session.workspaceId,
      conversationId,
      requestKey: id(row.id),
      objectKey: `${runId}/${id(row.id)}`,
      hash: createHash("sha256").update(row.data).digest("hex"),
      bytes: row.data.byteLength,
      mime,
      title: text(row.title),
      time: text(row.time),
      state: "ready",
      createdAt: Date.parse(session.createdAt),
    };
    projection.images.push({ asset, data: row.data });
    projection.entries.push({
      id: asset.id,
      conversationId,
      kind: "captures",
      segmentId: null,
      data: publicCapture(asset),
    });
  }
}
