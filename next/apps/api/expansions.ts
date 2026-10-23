import { Elysia } from "elysia";
import type { ExpansionService } from "../../packages/expansions/service.ts";
import type { ExpansionStatus } from "../../packages/expansions/status.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import {
  expansionParams,
  expansionPrepare,
  expansionRequest,
} from "../../packages/contracts/expansions.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { localeFrom, message } from "../../packages/i18n/messages.ts";

function present(value: ExpansionStatus, request: Request) {
  if (!("messageCode" in value)) return value;
  const { messageCode, ...result } = value;
  return {
    ...result,
    message: message(
      messageCode,
      localeFrom(request.headers.get("accept-language")),
    ),
  };
}
export function expansionRoutes(
  service: ExpansionService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({
    name: `expansions-${prefix}`,
    prefix: `${prefix}/sessions/:id/responses/:responseId/tell-me-more`,
  })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { principal };
    })
    .get(
      "/",
      async ({ principal, params, request }) =>
        present(
          await service.status(
            principal.workspaceId,
            params.id,
            params.responseId,
          ),
          request,
        ),
      { params: expansionParams },
    )
    .post(
      "/",
      async ({ principal, params, body, request, set }) => {
        const value = await service.prepare(
          principal.workspaceId,
          params.id,
          params.responseId,
          body.requestId,
          async () => {
            const current = await identity.resolve(request);
            return (
              current?.workspaceId === principal.workspaceId &&
              current.userId === principal.userId
            );
          },
        );
        set.status = value.status === "generating" ? 202 : 200;
        return present(value, request);
      },
      { params: expansionParams, body: expansionPrepare },
    )
    .post(
      "/reveal",
      async ({ principal, params, body, request }) =>
        present(
          await service.reveal(
            principal.workspaceId,
            params.id,
            params.responseId,
            body.requestId,
          ),
          request,
        ),
      { params: expansionParams, body: expansionRequest },
    )
    .post(
      "/cancel",
      async ({ principal, params, body, request }) =>
        present(
          await service.cancel(
            principal.workspaceId,
            params.id,
            params.responseId,
            body.requestId,
          ),
          request,
        ),
      { params: expansionParams, body: expansionRequest },
    );
}
