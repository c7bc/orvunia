import { Elysia } from "elysia";
import { z } from "zod";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";
export function personalRoutes(
  identity: Identity,
  reset: ((workspaceId: string) => Promise<void>) | undefined,
  prefix: string,
) {
  return new Elysia({ name: `personal-${prefix}`, prefix }).delete(
    "/workspace",
    async ({ request, body }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      if (!reset || request.headers.get("x-cadence-request") !== "1")
        throw new HttpError("forbidden", 403);
      z.object({ confirmation: z.literal("EXCLUIR") })
        .strict()
        .parse(body);
      await reset(principal.workspaceId);
      return { ok: true };
    },
  );
}
