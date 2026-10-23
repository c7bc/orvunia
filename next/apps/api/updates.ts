import { Elysia } from "elysia";
import type { Identity } from "../../packages/identity/principal.ts";
import type { UpdateService } from "../../packages/updates/service.ts";
import { updateTarget } from "../../packages/updates/contracts.ts";
import { HttpError } from "../../packages/http/errors.ts";
export function updateRoutes(
  service: UpdateService,
  identity: Identity,
  prefix: string,
) {
  return new Elysia({ name: `updates-${prefix}`, prefix }).get(
    "/updates",
    async ({ request, query }) => {
      if (!(await identity.resolve(request)))
        throw new HttpError("unauthorized", 401);
      return service.check(query);
    },
    { query: updateTarget },
  );
}
