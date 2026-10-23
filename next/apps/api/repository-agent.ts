import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import type { Identity } from "../../packages/identity/principal.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { RepositoryAgent } from "../../packages/repository-agent/service.ts";
import { RepositoryAgentError } from "../../packages/repository-agent/domain.ts";
import { repositoryAgentView } from "../../packages/repository-agent/presentation.ts";
import { startSchema, toolReplySchema } from "../../packages/repository-agent/contracts.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { repositoryAgentMessage } from "../../packages/repository-agent/messages.ts";
import { eventStream } from "../../packages/http/stream.ts";

const sessionParams = z.object({ id: z.string().min(1).max(128) });
const jobParams = sessionParams.extend({ jobId: z.string().min(1).max(128) });
const alias = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 24);

export function repositoryAgentRoutes(service: RepositoryAgent, identity: Identity,
  sessions: SessionRepository, prefix: string) {
  async function owner(request: Request, sessionId: string) {
    const principal = await identity.resolve(request);
    if (!principal) throw new HttpError("unauthorized", 401);
    const session = await sessions.find(principal.workspaceId, sessionId);
    if (!session) throw new HttpError("not_found", 404);
    return { workspaceId: principal.workspaceId, actorId: principal.userId, sessionId };
  }
  return new Elysia({ name: `repository-agent-${prefix}`, prefix: `${prefix}/sessions` })
    .onError(({ error, set, request }) => {
      if (!(error instanceof RepositoryAgentError)) return;
      set.status = error.status;
      return { error: { code: error.code, message: repositoryAgentMessage(error.code, request.headers.get("accept-language")) } };
    })
    .get("/:id/repository-agent/binding", async ({ request, params }) => {
      const current = await owner(request, params.id);
      return { workspaceId: alias(current.workspaceId), actorId: alias(current.actorId), sessionId: current.sessionId };
    }, { params: sessionParams })
    .post("/:id/repository-agent/jobs", async ({ request, params, body, set }) => {
      const job = await service.start(await owner(request, params.id), body);
      set.status = 202;
      return repositoryAgentView(job);
    }, { params: sessionParams, body: startSchema })
    .get("/:id/repository-agent/jobs/:jobId", async ({ request, params }) =>
      repositoryAgentView(await service.get(await owner(request, params.id), params.jobId)), { params: jobParams })
    .post("/:id/repository-agent/jobs/:jobId/advance", async ({ request, params }) =>
      repositoryAgentView(await service.advance(await owner(request, params.id), params.jobId, request.signal)),
    { params: jobParams })
    .post("/:id/repository-agent/jobs/:jobId/advance/stream", async ({ request, params }) => {
      const current = await owner(request, params.id);
      await service.get(current, params.jobId);
      return eventStream(request, async (signal, emit) => repositoryAgentView(
        await service.advance(current, params.jobId, signal, text => emit("delta", { text }))));
    }, { params: jobParams })
    .post("/:id/repository-agent/jobs/:jobId/tools", async ({ request, params, body }) =>
      repositoryAgentView(await service.reply(await owner(request, params.id), params.jobId, body)),
    { params: jobParams, body: toolReplySchema })
    .delete("/:id/repository-agent/jobs/:jobId", async ({ request, params }) =>
      repositoryAgentView(await service.cancel(await owner(request, params.id), params.jobId)), { params: jobParams });
}
