import { Elysia } from "elysia";
import { ConnectionError, type Capability } from "./domain.ts";
import type { ConnectionService } from "./service.ts";
import { HttpError, errorResponse } from "../http/errors.ts";
import { localeFrom, message } from "../i18n/messages.ts";
export type ConnectionProbe = {
  test(connection: Awaited<ReturnType<ConnectionService["effective"]>>, signal: AbortSignal): Promise<{
    ready: boolean; capabilities: Capability[]; errorCode?: string;
  }>;
  models(connection: Awaited<ReturnType<ConnectionService["effective"]>>, signal: AbortSignal): Promise<{
    id: string; capabilities: Capability[];
  }[]>;
};
export function connectionRoutes(options: {
  service: ConnectionService; probe: ConnectionProbe;
  prefix?: string;
  authorize(request: Request): Promise<void | Response> | void | Response;
}) {
  return new Elysia({ name: `personal-connections-${options.prefix ?? ""}`, prefix: options.prefix ?? "" })
    .onBeforeHandle(({ request }) => options.authorize(request))
    .onError(({ error, set, request }) => {
      const requestId = crypto.randomUUID();
      if (error instanceof HttpError) return errorResponse(error, request, requestId);
      const locale = localeFrom(request.headers.get("accept-language"));
      if (error instanceof ConnectionError) {
        set.status = error.status;
        return { code: error.code, message: message(error.status === 503 ?
          "provider_settings_unreadable" : "invalid_input", locale), requestId };
      }
      set.status = 503;
      return { code: "connection_unavailable", message: message("provider_unavailable", locale), requestId };
    })
    .get("/ai/connections", () => options.service.public())
    .put("/ai/connections", ({ body }) => options.service.save(body))
    .post("/ai/connections/:id/test", async ({ params }) => {
      const requestId = crypto.randomUUID();
      try {
        const connection = await options.service.effective(params.id);
        const result = await bounded((signal) => options.probe.test(connection, signal));
        return { requestId, ready: result.ready, capabilities: result.capabilities,
          ...(result.errorCode ? { errorCode: "connection_unavailable" } : {}) };
      } catch (error) {
        if (error instanceof ConnectionError) throw error;
        throw new ConnectionError("connection_unavailable", 503);
      }
    })
    .get("/ai/connections/:id/models", async ({ params }) => {
      const connection = await options.service.effective(params.id);
      const models = await bounded((signal) => options.probe.models(connection, signal));
      return { models: models.slice(0, 500).map((model) => ({ id: model.id.slice(0, 160),
        capabilities: model.capabilities.filter((item) => connection.capabilities.includes(item)) })) };
    });
}
async function bounded<Result>(operation: (signal: AbortSignal) => Promise<Result>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ConnectionError("connection_unavailable", 503)); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
}
