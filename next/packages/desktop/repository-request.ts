import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";

export async function nativeRepositoryRequest(context: NativeContext, request: PlatformInvocation,
  path: string, signal: AbortSignal, validate: () => void) {
  validate();
  const headers = new Headers({ Origin: context.origin, "X-Cadence-Request": "1" });
  const token = context.deployment === "local" ? context.identity?.token : null;
  if (token) headers.set("Authorization", "Bearer " + token);
  const options: RequestInit = { method: "GET", credentials: "include", redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]), headers };
  const url = context.origin + "/api" + path;
  const response = token ? await fetch(url, options) : await request.sender.session.fetch(url, options);
  validate();
  if (!response.ok) throw Error("repository_identity_changed");
  return response.json();
}
