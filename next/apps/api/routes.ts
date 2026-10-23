import { Elysia } from "elysia";
import {
  conversationInput,
  conversationParams,
  conversationQuery,
  notesInput,
} from "../../packages/contracts/conversations.ts";
import type { ConversationService } from "../../packages/conversations/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";

export function conversationRoutes(
  service: ConversationService,
  identity: Identity,
) {
  return new Elysia({ name: "conversations", prefix: "/api/v1/conversations" })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { principal };
    })
    .get(
      "/",
      ({ principal, query }) =>
        service.list(principal.workspaceId, query.limit, query.before),
      { query: conversationQuery },
    )
    .post(
      "/",
      ({ principal, body, set }) => {
        set.status = 201;
        return service.create(principal.workspaceId, body);
      },
      { body: conversationInput },
    )
    .get(
      "/:id",
      ({ principal, params }) => service.find(principal.workspaceId, params.id),
      { params: conversationParams },
    )
    .post(
      "/:id/end",
      ({ principal, params }) => service.end(principal.workspaceId, params.id),
      { params: conversationParams },
    )
    .get(
      "/:id/notes",
      ({ principal, params }) =>
        service.notes(principal.workspaceId, params.id),
      { params: conversationParams },
    )
    .patch(
      "/:id/notes",
      ({ principal, params, body }) =>
        service.updateNotes(principal.workspaceId, params.id, body),
      {
        params: conversationParams,
        body: notesInput,
      },
    );
}
