import { Elysia } from "elysia";
import { z } from "zod";
import type { LocalModelComposition } from "../../packages/local-models/compose.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { assessCompatibility } from "../../packages/local-models/compatibility.ts";
import { modelDownloadInput, modelLoadInput, modelRemovalInput,
  modelImportInput, compatibilityInput, publicModelJob } from "../../packages/local-models/contracts.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError, errorResponse } from "../../packages/http/errors.ts";

export function localModelRoutes(models: LocalModelComposition["service"], identity: Identity, prefix: string) {
  return new Elysia({ name: `local-models-${prefix}`, prefix: `${prefix}/local-models` })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { actor: principal.workspaceId };
    })
    .onError(({ error, request }) => errorResponse(error instanceof HttpError || error instanceof LocalModelError
      ? error : new HttpError("local_model_unavailable", 503), request, crypto.randomUUID()))
    .get("/catalog", () => ({ models: models.catalog.listVisible(models.listInstallations(), models.listJobs()) }))
    .get("/hardware", () => models.hardware())
    .get("/installations", () => ({ installations: models.listInstallations(), runtimes: models.lifecycle.status() }))
    .get("/jobs", () => ({ jobs: models.listJobs().map(publicModelJob) }))
    .get("/jobs/:id", ({ params }) => {
      const job = models.registry.findJob(params.id);
      if (!job) throw new LocalModelError("job_not_found", 404);
      return publicModelJob(job);
    })
    .post("/compatibility", async ({ body }) => assessCompatibility(models.catalog.find(body.catalogId, body.revision),
      await models.hardware(), body), { body: compatibilityInput })
    .post("/downloads", ({ body, set }) => {
      const job = models.downloads.create(body);
      models.queue.wake(); set.status = 202;
      return publicModelJob(job);
    }, { body: modelDownloadInput })
    .post("/jobs/:id/resume", ({ params, set }) => {
      const job = models.downloads.enqueue(params.id);
      models.queue.wake(); set.status = 202;
      return publicModelJob(job);
    }, { body: z.object({}).strict() })
    .delete("/jobs/:id", ({ params }) => publicModelJob(models.downloads.cancel(params.id)))
    .post("/installations/:id/load", ({ params, body, request }) => models.lifecycle.load(params.id, body, request.signal), { body: modelLoadInput })
    .post("/installations/:id/unload", async ({ params }) => { await models.lifecycle.unload(params.id); return { unloaded: true }; })
    .delete("/installations/:id", async ({ params, body }) => {
      await models.lifecycle.remove(params.id, body.expectedRevision, body.requestId); return { removed: true };
    }, { body: modelRemovalInput })
    .post("/imports", async ({ body, actor, request }) => publicModelJob(await models.imports.import(actor, body, request.signal)), { body: modelImportInput });
}
