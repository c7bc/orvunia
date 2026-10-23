import { z } from "zod";
import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";
const update = z.object({
  status: z.literal("available"),
  release: z.object({ url: z.url() }),
});
export async function openNativeUpdate(
  context: NativeContext,
  request: PlatformInvocation,
  value: unknown,
  interactive: () => void,
  validate: () => void,
  fetcher: (url: string, options: RequestInit) => Promise<Response> = fetch,
) {
  validate();
  interactive();
  context.abort.signal.throwIfAborted();
  const query = new URLSearchParams({
    version: context.electron.app.getVersion(),
    platform: context.process.platform,
    arch: context.process.arch,
  });
  const privateRuntime = context.deployment === "local" && context.identity;
  const headers = new Headers({ Origin: context.origin });
  if (privateRuntime)
    headers.set("Authorization", "Bearer " + privateRuntime.token);
  const options: RequestInit = {
    redirect: "error",
    signal: AbortSignal.any([context.abort.signal, AbortSignal.timeout(7000)]),
    headers,
    credentials: "include",
  };
  const endpoint = `${context.origin}/api/updates?${query}`;
  const response = privateRuntime
    ? await fetcher(endpoint, options)
    : await request.sender.session.fetch(endpoint, options);
  if (!response.ok) throw Error("Não foi possível verificar a atualização.");
  const result = update.safeParse(await response.json());
  context.abort.signal.throwIfAborted();
  validate();
  interactive();
  if (!result.success || result.data.release.url !== value)
    throw Error("Atualização indisponível.");
  const url = new URL(result.data.release.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Atualização inválida.");
  await context.electron.shell.openExternal(url.href);
  return { opened: true };
}
