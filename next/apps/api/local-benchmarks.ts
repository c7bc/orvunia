import { Elysia } from "elysia";
import { z } from "zod";
import type { ModelBenchmarks } from "../../packages/local-models/benchmarks/service.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError, errorResponse } from "../../packages/http/errors.ts";

export function localBenchmarkRoutes(benchmarks: ModelBenchmarks, identity: Identity, prefix: string) {
  return new Elysia({ name: `local-benchmarks-${prefix}`, prefix: `${prefix}/local-models` })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { actor: principal.workspaceId };
    })
    .onError(({ error, request }) => errorResponse(error instanceof HttpError || error instanceof LocalModelError
      || error instanceof z.ZodError ? error : new HttpError("local_model_unavailable", 503), request, crypto.randomUUID()))
    .post("/installations/:id/benchmark", ({ actor, params, body, set }) => {
      const input = z.object({ requestId: z.uuid(), consent: z.boolean() }).strict().parse(body);
      const id = z.uuid().parse(params.id);
      const job = benchmarks.create(actor, id, input);
      set.status = 202;
      return job;
    })
    .get("/installations/:id/benchmarks", ({ actor, params }) => ({
      benchmarks: benchmarks.list(actor, z.uuid().parse(params.id)),
    }))
    .delete("/benchmarks/:id", ({ actor, params }) => benchmarks.cancel(actor, z.uuid().parse(params.id)));
}
