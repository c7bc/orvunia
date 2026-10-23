import { Elysia } from "elysia";
import { z } from "zod";
import type { AssetService } from "../../packages/assets/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { conversationParams } from "../../packages/contracts/conversations.ts";

const upload = z
  .object({
    file: z.file().max(4 * 1024 * 1024),
    title: z.string().min(1).max(100).optional(),
    time: z
      .string()
      .regex(/^\d{2,3}:\d{2}$/)
      .default("00:00"),
  })
  .strict();
export function assetRoutes(
  service: AssetService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({ name: `assets-${prefix}`, prefix: `${prefix}/sessions` })
    .resolve(async ({ request }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { workspaceId: principal.workspaceId };
    })
    .post(
      "/:id/captures",
      async ({ workspaceId, params, request, body }) =>
        service.upload(workspaceId, params.id, {
          data: new Uint8Array(await body.file.arrayBuffer()),
          mime: body.file.type,
          title: body.title ?? "Contexto visual",
          time: body.time,
          requestKey: z
            .uuid()
            .parse(
              request.headers.get("idempotency-key") ?? crypto.randomUUID(),
            ),
        }),
      { body: upload, params: conversationParams },
    )
    .get(
      "/:id/captures/:capture",
      async ({ workspaceId, params }) => {
        const content = await service.download(
          workspaceId,
          params.id,
          params.capture,
        );
        if (content.url) return Response.redirect(content.url, 302);
        return new Response(
          content.data ? new Uint8Array(content.data) : null,
          {
            headers: {
              "content-type": content.mime ?? "application/octet-stream",
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          },
        );
      },
      { params: conversationParams.extend({ capture: z.uuid() }) },
    )
    .delete(
      "/:id/captures/:capture",
      async ({ workspaceId, params }) => {
        await service.remove(workspaceId, params.id, params.capture);
        return { ok: true };
      },
      { params: conversationParams.extend({ capture: z.uuid() }) },
    );
}
