import { Elysia } from "elysia";
import { definedFields } from "../../packages/contracts/defined.ts";
import {
  profileSchema,
  preferencesSchema,
  librarySchema,
} from "../../packages/contracts/workspace.ts";
import {
  createModeInput,
  customModePatchSchema,
  modeParams,
} from "../../packages/contracts/modes.ts";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";
import type { ModeService } from "../../packages/workspaces/modes.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";

export function workspaceRoutes(
  service: WorkspaceService,
  modes: ModeService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({ name: `workspace-${prefix}`, prefix })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { workspaceId: principal.workspaceId };
    })
    .get("/context", async ({ workspaceId }) => {
      const workspace = await service.find(workspaceId);
      return { profile: workspace.profile, preferences: workspace.preferences };
    })
    .put(
      "/profile",
      async ({ workspaceId, body }) => ({
        profile: await service.saveProfile(workspaceId, body),
      }),
      { body: profileSchema },
    )
    .put(
      "/preferences",
      async ({ workspaceId, body }) => ({
        preferences: await service.savePreferences(workspaceId, body),
      }),
      { body: preferencesSchema },
    )
    .get(
      "/library",
      async ({ workspaceId }) => (await service.find(workspaceId)).library,
    )
    .put(
      "/library",
      async ({ workspaceId, body }) =>
        service.saveLibrary(workspaceId, {
          ...body,
          documents: body.documents.map(definedFields),
        }),
      { body: librarySchema },
    )
    .get("/modes", ({ workspaceId }) => modes.list(workspaceId))
    .post(
      "/modes",
      ({ workspaceId, body }) => modes.create(workspaceId, definedFields(body)),
      {
        body: createModeInput,
      },
    )
    .patch(
      "/modes/:modeId",
      ({ workspaceId, params, body }) =>
        modes.edit(workspaceId, params.modeId, definedFields(body)),
      {
        params: modeParams,
        body: customModePatchSchema,
      },
    )
    .delete(
      "/modes/:modeId",
      ({ workspaceId, params }) => modes.remove(workspaceId, params.modeId),
      { params: modeParams },
    )
    .post(
      "/modes/:modeId/activate",
      ({ workspaceId, params }) => modes.activate(workspaceId, params.modeId),
      { params: modeParams },
    );
}
