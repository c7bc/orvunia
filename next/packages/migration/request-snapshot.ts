import { z } from "zod";
import { createHash } from "node:crypto";
import { answerSchema } from "../contracts/answers.ts";
import { profileSchema, preferencesSchema } from "../contracts/workspace.ts";
import { transcriptInput } from "../contracts/sessions.ts";
import { buildInstructions } from "../answers/instructions.ts";
import { imageMime } from "../assets/images.ts";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import type { OperationSnapshot } from "../operations/domain.ts";
import { responseConnection } from "../contracts/providers.ts";
const provider = responseConnection.omit({ apiKey: true, clearKey: true });
const context = z.object({
  version: z.literal(1),
  context: z.object({
    input: answerSchema,
    profile: profileSchema.nullable(),
    preferences: preferencesSchema,
    modeSystemPrompt: z.string().max(32768).optional(),
    documents: z.string().optional(),
    session: z
      .object({
        id: z.uuid(),
        owner: z.uuid(),
        state: z.enum(["active", "paused", "ended"]),
        transcripts: z.array(transcriptInput.extend({ id: z.uuid() })),
        responses: z.array(z.object({ text: z.string() }).passthrough()),
      })
      .passthrough(),
    providerParameters: provider,
  }),
});
export function requestSnapshot(
  reader: LegacyReader,
  projection: LegacyProjection,
  request: {
    id: string;
    owner: string;
    session: string;
    payload: string;
    request_hash: string;
  },
  runId: string,
  expansion = false,
): OperationSnapshot {
  const value = context.parse(JSON.parse(request.payload)).context;
  if (value.input.requestId !== request.id)
    throw Error("Legacy request context identifier mismatch");
  if (
    !expansion &&
    createHash("sha256").update(JSON.stringify(value.input)).digest("hex") !==
      request.request_hash
  )
    throw Error("Legacy request context fingerprint mismatch");
  if (
    value.session.id !== request.session ||
    value.session.owner !== request.owner
  )
    throw Error("Legacy request context ownership mismatch");
  const session = projection.sessions.find(
    (item) => item.id === request.session && item.workspaceId === request.owner,
  );
  if (!session) throw Error("Legacy request has inconsistent ownership");
  const images = reader
    .rows("answer_request_images")
    .filter((image) => image.request_id === request.id)
    .sort((a, b) => Number(a.ordinal) - Number(b.ordinal))
    .map((row) => {
      const id = z.uuid().parse(row.capture_id);
      if (!(row.data instanceof Uint8Array))
        throw Error("Invalid legacy request image");
      const mime = imageMime(row.data),
        hash = createHash("sha256").update(row.data).digest("hex");
      if (row.mime !== mime) throw Error("Legacy request image MIME mismatch");
      let existing = projection.images.find((image) => image.asset.id === id);
      if (
        existing &&
        (existing.asset.hash !== hash ||
          existing.asset.mime !== mime ||
          existing.asset.workspaceId !== request.owner ||
          existing.asset.conversationId !== request.session)
      )
        throw Error("Legacy request image identity mismatch");
      if (!existing) {
        existing = {
          data: row.data,
          asset: {
            id,
            workspaceId: request.owner,
            conversationId: request.session,
            requestKey: id,
            objectKey: `${runId}/${id}`,
            hash,
            bytes: row.data.byteLength,
            mime,
            title: "",
            time: "00:00",
            state: "deleting",
            createdAt: Date.parse(session.createdAt),
          },
        };
        projection.images.push(existing);
      }
      const asset = existing.asset;
      return { id, key: asset.objectKey, hash, bytes: asset.bytes, mime };
    });
  return {
    version: 1,
    allowEnded: expansion || value.session.state === "ended",
    historyGeneration: session.historyGeneration,
    instructions: buildInstructions({
      input: value.input, profile: value.profile, preferences: value.preferences,
      ...(value.modeSystemPrompt === undefined ? {} : { modeSystemPrompt: value.modeSystemPrompt }),
    }),
    context: JSON.stringify({
      candidate: value.profile,
      job: value.profile?.description,
      documents: value.documents ?? "",
      transcript: value.session.transcripts.slice(-80),
      previous_answers: value.session.responses
        .slice(-3)
        .map((response) => response.text.slice(0, 6000)),
      question: value.input.question,
      problem: value.input.problem,
    }),
    images,
    provider: value.providerParameters,
    metadata: {
      action: value.input.action,
      mode: value.input.mode,
      question: value.input.question,
    },
  };
}
