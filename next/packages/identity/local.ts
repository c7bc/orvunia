import { createHash, timingSafeEqual } from "node:crypto";
import type { Identity } from "./principal.ts";
import { localeFrom } from "../i18n/messages.ts";

export function localIdentity(
  token: string,
  workspaceId: string,
  activeWorkspace: () => Promise<string> = async () => workspaceId,
  browserAuthorization?: (request: Request) => boolean,
): Identity {
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  return {
    async resolve(request) {
      const actual = createHash("sha256")
        .update(request.headers.get("authorization") ?? "")
        .digest();
      if (
        !timingSafeEqual(actual, expected) &&
        !browserAuthorization?.(request)
      )
        return null;
      return {
        userId: workspaceId,
        workspaceId: await activeWorkspace(),
        locale: localeFrom(request.headers.get("accept-language")),
      };
    },
  };
}
