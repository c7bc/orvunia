import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import type { ApiDependencies } from "./core-dependencies.ts";
import { indexQuery } from "../../packages/contracts/index.ts";
import { definedFields } from "../../packages/contracts/defined.ts";
import { HttpError } from "../../packages/http/errors.ts";

export function bootstrapRoutes(dependencies: ApiDependencies, prefix: string) {
  const { index, workspace, sessions } = dependencies;
  return new Elysia({ name: `bootstrap-${prefix}`, prefix })
    .resolve(async ({ request }) => {
      const principal = await dependencies.identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      return { workspaceId: principal.workspaceId };
    })
    .get(
      "/session-index",
      ({ workspaceId, query }) => {
        if (!index) throw new HttpError("unavailable", 503);
        return index.page(workspaceId, definedFields(query));
      },
      { query: indexQuery },
    )
    .get(
      "/bootstrap",
      async ({ workspaceId, query }) => {
        if (!index || !workspace || !sessions)
          throw new HttpError("unavailable", 503);
        const context = await workspace.service.find(workspaceId);
        const result = {
          workspaceId: createHash("sha256")
            .update(workspaceId)
            .digest("hex")
            .slice(0, 24),
          profile: context.profile,
          preferences: context.preferences,
        };
        const first = await index.page(workspaceId, { limit: 100, search: "" });
        if (query.compact === "1")
          return {
            ...result,
            sessions: first.items,
            sessionIndex: { before: first.before },
          };
        const complete: Awaited<ReturnType<typeof sessions.history.full>>[] =
          [];
        let page = first;
        while (true) {
          for (const item of page.items)
            complete.push(await sessions.history.full(workspaceId, item.id));
          if (!page.before) break;
          page = await index.page(workspaceId, {
            limit: 100,
            search: "",
            before: page.before,
          });
        }
        return { ...result, sessions: complete };
      },
      { query: z.object({ compact: z.enum(["0", "1"]).optional() }).strict() },
    );
}
