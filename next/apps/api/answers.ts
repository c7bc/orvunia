import { z } from "zod";
import { Elysia } from "elysia";
import type { AnswerService } from "../../packages/answers/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { conversationParams } from "../../packages/contracts/conversations.ts";
import { answerSchema } from "../../packages/contracts/answers.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { eventStream } from "../../packages/http/stream.ts";

export function answerRoutes(
  service: AnswerService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({
    name: `answers-${prefix}`,
    prefix: `${prefix}/sessions`,
  }).post(
    "/:id/:command",
    async ({ params, body, request }) => {
      if (!["answers", "review"].includes(params.command))
        throw new HttpError("not_found", 404);
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      const operation = await service.prepare(
        principal.workspaceId,
        params.id,
        body,
        params.command === "review",
      );
      return eventStream(request, (signal, emit) =>
        service.run(
          operation,
          signal,
          (text) => emit("delta", { text }),
          async () => {
            const current = await identity.resolve(request);
            return (
              current?.workspaceId === principal.workspaceId &&
              current.userId === principal.userId
            );
          },
        ),
      );
    },
    {
      body: answerSchema,
      params: conversationParams.extend({
        command: z.enum(["answers", "review"]),
      }),
    },
  );
}
