import { z } from "zod";
import { Elysia } from "elysia";
import type { RecordedTranscriptionService } from "../../packages/transcription/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { conversationParams } from "../../packages/contracts/conversations.ts";
import { HttpError } from "../../packages/http/errors.ts";

const upload = z
  .object({
    file: z.file().max(25 * 1024 * 1024),
    segmentId: z.uuid(),
    language: z
      .union([z.literal("auto"), z.string().regex(/^[a-z]{2}$/)])
      .optional(),
    who: z.string().trim().min(1).max(60).default("Áudio"),
    time: z
      .string()
      .regex(/^\d{2,3}:\d{2}$/)
      .default("00:00"),
  })
  .strict();
export function transcriptionRoutes(
  service: RecordedTranscriptionService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({
    name: `transcription-${prefix}`,
    prefix: `${prefix}/sessions`,
  }).post(
    "/:id/transcribe",
    async ({ params, body, request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return service.transcribe(
        principal.workspaceId,
        params.id,
        {
          data: new Uint8Array(await body.file.arrayBuffer()),
          name:
            body.file.name.replaceAll("\\", "/").split("/").at(-1) ?? "audio",
          mime: body.file.type,
          segmentId: body.segmentId,
          who: body.who,
          time: body.time,
          ...(body.language ? { language: body.language } : {}),
        },
        request.signal,
        async () => {
          const current = await identity.resolve(request);
          return (
            current?.workspaceId === principal.workspaceId &&
            current.userId === principal.userId
          );
        },
      );
    },
    { params: conversationParams, body: upload },
  );
}
