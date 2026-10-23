import { Elysia } from "elysia";
import { z } from "zod";
import {
  sessionInput,
  sessionPatch,
  transcriptInput,
  historyKind,
} from "../../packages/contracts/sessions.ts";
import {
  conversationParams,
  notesInput,
} from "../../packages/contracts/conversations.ts";
import { definedFields } from "../../packages/contracts/defined.ts";
import type { ConversationService } from "../../packages/conversations/service.ts";
import type { SessionService } from "../../packages/sessions/service.ts";
import type { SessionHistory } from "../../packages/sessions/history.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";

export type SessionApi = { service: SessionService; history: SessionHistory };
const pageQuery = z
  .object({
    before: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export function sessionRoutes(
  { service, history }: SessionApi,
  notes: ConversationService,
  identity: Identity,
  prefix: string,
) {
  const result = (workspaceId: string, id: string, request: Request) =>
    request.headers.get("x-cadence-history") === "window"
      ? history.view(workspaceId, id)
      : history.full(workspaceId, id);
  return new Elysia({
    name: `sessions-${prefix}`,
    prefix: `${prefix}/sessions`,
  })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { workspaceId: principal.workspaceId };
    })
    .get("/", async ({ workspaceId }) =>
      Promise.all(
        (await service.list(workspaceId, 100)).map((session) =>
          history.full(workspaceId, session.id),
        ),
      ),
    )
    .post(
      "/",
      async ({ workspaceId, body }) => {
        const session = await service.create(workspaceId, definedFields(body));
        return history.full(workspaceId, session.id);
      },
      { body: sessionInput },
    )
    .get("/export", async ({ workspaceId }) => {
      const exported: Awaited<ReturnType<SessionHistory["full"]>>[] = [];
      let before: string | undefined;
      while (true) {
        const page = await service.list(workspaceId, 100, before);
        for (const session of page)
          exported.push(await history.full(workspaceId, session.id));
        if (page.length < 100) return exported;
        before = page.at(-1)?.id;
      }
    })
    .get(
      "/:id",
      ({ workspaceId, params }) => history.full(workspaceId, params.id),
      { params: conversationParams },
    )
    .get(
      "/:id/view",
      ({ workspaceId, params }) => history.view(workspaceId, params.id),
      { params: conversationParams },
    )
    .patch(
      "/:id",
      async ({ workspaceId, params, body, request }) => {
        await service.patch(workspaceId, params.id, definedFields(body));
        return result(workspaceId, params.id, request);
      },
      { params: conversationParams, body: sessionPatch },
    )
    .delete(
      "/:id",
      ({ workspaceId, params }) => service.remove(workspaceId, params.id),
      { params: conversationParams },
    )
    .post(
      "/:id/resume",
      async ({ workspaceId, params, request }) => {
        await service.resume(workspaceId, params.id);
        return result(workspaceId, params.id, request);
      },
      { params: conversationParams },
    )
    .post(
      "/:id/transcripts",
      ({ workspaceId, params, body }) =>
        service.transcript(workspaceId, params.id, definedFields(body)),
      {
        params: conversationParams,
        body: transcriptInput,
      },
    )
    .get(
      "/:id/history/:kind",
      ({ workspaceId, params, query }) =>
        history.page(
          workspaceId,
          params.id,
          params.kind,
          query.before,
          query.limit,
        ),
      {
        params: conversationParams.extend({ kind: historyKind }),
        query: pageQuery,
      },
    )
    .delete(
      "/:id/context/:kind",
      async ({ workspaceId, params }) => {
        await service.clear(workspaceId, params.id, params.kind);
        return { ok: true };
      },
      { params: conversationParams.extend({ kind: historyKind }) },
    )
    .get(
      "/:id/notes",
      ({ workspaceId, params }) => notes.notes(workspaceId, params.id),
      { params: conversationParams },
    )
    .patch(
      "/:id/notes",
      ({ workspaceId, params, body }) =>
        notes.updateNotes(workspaceId, params.id, body),
      { params: conversationParams, body: notesInput },
    );
}
