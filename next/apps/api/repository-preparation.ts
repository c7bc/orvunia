import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import type { Identity } from "../../packages/identity/principal.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";
import { HttpError } from "../../packages/http/errors.ts";

const alias = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 24);
export function repositoryPreparationRoutes(identity: Identity, workspaces: WorkspaceService,
  sessions: SessionRepository, prefix: string) {
  async function principal(request: Request) {
    const current = await identity.resolve(request);
    if (!current) throw new HttpError("unauthorized", 401);
    return current;
  }
  return new Elysia({ name: `repository-preparation-${prefix}`, prefix: `${prefix}/repository-preparation` })
    .get("/modes/:modeId", async ({ request, params }) => {
      const current = await principal(request);
      const workspace = await workspaces.find(current.workspaceId);
      if (!workspace.modes.some(mode => mode.id === params.modeId && mode.base === "technical"))
        throw new HttpError("not_found", 404);
      return { workspaceId: alias(current.workspaceId), actorId: alias(current.userId), modeId: params.modeId };
    }, { params: z.object({ modeId: z.string().min(1).max(128) }) })
    .get("/sessions/:id", async ({ request, params }) => {
      const current = await principal(request);
      const session = await sessions.find(current.workspaceId, params.id);
      if (!session || session.state !== "active" || session.mode !== "technical")
        throw new HttpError("not_found", 404);
      return { workspaceId: alias(current.workspaceId), actorId: alias(current.userId),
        sessionId: session.id, modeId: session.modeSnapshot?.id ?? session.mode };
    }, { params: z.object({ id: z.uuid() }) });
}
