import { Elysia } from "elysia";
import { z } from "zod";
import type { RealtimeService } from "../../packages/realtime/service.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError } from "../../packages/http/errors.ts";
type Channel = ReturnType<RealtimeService["open"]>;
export function realtimeRoutes(
  service: RealtimeService,
  identity: Identity,
  prefix: string,
) {
  const channels = new Map<string, Channel>();
  return new Elysia({ name: `realtime-${prefix}`, prefix })
    .post(
      "/sessions/:id/realtime-ticket",
      async ({ request, params, body }) => {
        const principal = await identity.resolve(request);
        if (!principal) throw new HttpError("unauthorized", 401);
        return service.issue(principal, params.id, body.who);
      },
      {
        params: z.object({ id: z.uuid() }),
        body: z.object({ who: z.enum(["Eu", "Entrevistador"]) }).strict(),
      },
    )
    .use(
      new Elysia({ name: `realtime-socket-${prefix}` })
        .resolve(async ({ request, query }) => {
          if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
            throw new HttpError("invalid_input", 400);
          const { ticket } = z
            .object({ ticket: z.uuid() })
            .strict()
            .parse(query);
          return { ticket: await service.accept(request, ticket) };
        })
        .ws("/realtime", {
          open(socket) {
            const channel = service.open(
              socket.data.ticket,
              {
                send: (value) => socket.raw.send(JSON.stringify(value)) !== 0,
                close: (code) => socket.close(code),
              },
              socket.data.request,
            );
            channels.set(socket.id, channel);
          },
          message(socket, value) {
            channels.get(socket.id)?.receive(value);
          },
          async close(socket) {
            const channel = channels.get(socket.id);
            channels.delete(socket.id);
            await channel?.close();
          },
        }),
    );
}
