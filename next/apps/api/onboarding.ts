import { Elysia } from "elysia";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { onboarding } from "../../packages/workspaces/onboarding.ts";
import { onboardingSchema } from "../../packages/contracts/onboarding.ts";
import { HttpError } from "../../packages/http/errors.ts";

export function onboardingRoutes(
  workspace: WorkspaceService,
  identity: Identity,
  prefix: string,
) {
  const service = onboarding(workspace);
  return new Elysia({
    name: `onboarding-${prefix}`,
    prefix: `${prefix}/onboarding`,
  })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { workspaceId: principal.workspaceId };
    })
    .get("/", ({ workspaceId }) => service.find(workspaceId))
    .put("/", ({ workspaceId, body }) => service.save(workspaceId, body), {
      body: onboardingSchema,
    });
}
