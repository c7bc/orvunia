import { Elysia } from "elysia";
import { z } from "zod";
import type { FollowupService } from "../../packages/followups/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import {
  followupDraft,
  followupSend,
} from "../../packages/contracts/followups.ts";
import { HttpError } from "../../packages/http/errors.ts";
export function followupRoutes(
  service: FollowupService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({ name: `followups-${prefix}`, prefix })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { principal };
    })
    .get("/sessions/:id/followup", ({ principal, params }) =>
      service.get(principal.workspaceId, z.uuid().parse(params.id)),
    )
    .put("/sessions/:id/followup", ({ principal, params, body }) =>
      service.save(
        principal.workspaceId,
        z.uuid().parse(params.id),
        followupDraft.parse(body),
      ),
    )
    .post("/sessions/:id/followup/send", ({ principal, params, body }) =>
      service.send(
        principal.workspaceId,
        z.uuid().parse(params.id),
        followupSend.parse(body),
        principal.locale,
      ),
    );
}
