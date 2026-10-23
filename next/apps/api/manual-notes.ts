import { Elysia } from "elysia";
import type { ConversationService } from "../../packages/conversations/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";
export function manualNotesRoutes(
  service: ConversationService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({ name: `manual-notes-${prefix}`, prefix }).get(
    "/session-notes",
    async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { notes: await service.exportNotes(principal.workspaceId) };
    },
  );
}
