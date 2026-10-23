import { Elysia } from "elysia";
import { outputContext } from "./output-context.ts";
import { errorResponse, HttpError } from "../../packages/http/errors.ts";
import type { ApiDependencies } from "./core-dependencies.ts";
import { resourceRoutes } from "./resources.ts";
import { publicApiRequest } from "./public.ts";
import { workspaceScopedIdentity } from "../../packages/identity/workspace-scope.ts";
export type { ApiDependencies, LogEvent } from "./core-dependencies.ts";

export function createCoreApi(dependencies: ApiDependencies) {
  const requests = new WeakMap<Request, { id: string; started: number }>();
  return new Elysia({
    name: "cadence",
    serve: {
      maxRequestBodySize: dependencies.maximumBodyBytes ?? 6 * 1024 * 1024,
    },
    websocket: {
      maxPayloadLength: 32000,
      backpressureLimit: 512 * 1024,
      closeOnBackpressureLimit: true,
      idleTimeout: 60,
      perMessageDeflate: false,
    },
  })
    .onRequest(({ request, set }) => {
      const id = crypto.randomUUID();
      requests.set(request, { id, started: performance.now() });
      set.headers["X-Request-ID"] = id;
      set.headers["Cache-Control"] = "no-store";
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["Referrer-Policy"] = "no-referrer";
      const url = new URL(request.url);
      const origin = request.headers.get("origin");
      if (
        url.host !== new URL(dependencies.origin).host ||
        (origin && origin !== dependencies.origin)
      )
        throw new HttpError("forbidden", 403);
    })
    .onError(async ({ error, code, request, set }) => {
      const requestId = requests.get(request)?.id ?? crypto.randomUUID();
      let mapped =
        code === "VALIDATION" || code === "PARSE"
          ? new HttpError("invalid_input", 400)
          : code === "NOT_FOUND"
            ? new HttpError("not_found", 404)
            : error;
      if (code === "NOT_FOUND") {
        try {
          const client = await dependencies.client?.(request);
          if (client) {
            set.status = client.status;
            return client;
          }
        } catch {
          mapped = new HttpError("internal_error", 500);
        }
      }
      const response = errorResponse(mapped, request, requestId, dependencies.extension?.error(mapped));
      set.status = response.status;
      if (response.status >= 500)
        dependencies.log({
          event: "request_failed",
          requestId,
          status: response.status,
        });
      return response;
    })
    .mapResponse(async ({ request, response, set }) =>
      dependencies.extension?.projectOutput
        ? dependencies.extension.projectOutput(request, response, outputContext(set)) : undefined)
    .onAfterResponse(({ request, response, set, route }) => {
      const metadata = requests.get(request);
      if (!metadata) return;
      requests.delete(request);
      dependencies.log({
        event: "request_completed",
        requestId: metadata.id,
        method: request.method,
        path: route || "[unmatched]",
        status:
          response instanceof Response
            ? response.status
            : typeof set.status === "number"
              ? set.status
              : 200,
        durationMs:
          Math.round((performance.now() - metadata.started) * 100) / 100,
      });
    })
    .get("/health/live", () => ({ status: "ok" }))
    .get("/health/ready", async ({ set }) => {
      const ready = await dependencies.ready().catch(() => false);
      set.status = ready ? 200 : 503;
      return { status: ready ? "ok" : "unavailable" };
    })
    .onBeforeHandle(async ({ request }) => {
      if (
        new URL(request.url).pathname.startsWith("/api/") &&
        !publicApiRequest(request) &&
        !dependencies.extension?.publicRequest(request) &&
        dependencies.limit &&
        !(await dependencies.limit(request))
      ) {
        throw new HttpError("rate_limited", 429);
      }
    })
    .use(
      resourceRoutes({
        ...dependencies,
        identity: workspaceScopedIdentity(dependencies.identity),
      }),
    );
}
