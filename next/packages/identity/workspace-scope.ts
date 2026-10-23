import { createHash } from "node:crypto";
import type { Identity } from "./principal.ts";
import { HttpError } from "../http/errors.ts";
export function workspaceScopedIdentity(identity: Identity): Identity {
  return {
    async resolve(request) {
      const principal = await identity.resolve(request);
      if (!principal) return null;
      const expected = request.headers.get("x-cadence-workspace");
      if (expected !== null) {
        if (!/^[a-f0-9]{24}$/.test(expected))
          throw new HttpError("invalid_input", 400);
        const actual = createHash("sha256")
          .update(principal.workspaceId)
          .digest("hex")
          .slice(0, 24);
        if (expected !== actual) throw new HttpError("workspace_conflict", 409);
      }
      return principal;
    },
  };
}
