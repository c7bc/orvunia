import type { HttpFetch } from "../providers/http.ts";
import type { ReleaseFeed, UpdateTarget } from "./domain.ts";
import { selectRelease } from "./domain.ts";
import { releaseFeed, releaseUrl } from "./contracts.ts";
type UpdatePorts = {
  feedUrl?: string | undefined;
  transport: HttpFetch;
  clock(): number;
};
export function updateService(ports: UpdatePorts) {
  let cached: ReleaseFeed | null = null,
    cachedAt = 0;
  let pending: Promise<ReleaseFeed> | null = null;
  let controller: AbortController | null = null,
    closed = false;
  async function load() {
    if (cached && ports.clock() - cachedAt < 300000) return cached;
    pending ??= (async () => {
      controller = new AbortController();
      const response = await ports.transport(releaseUrl(ports.feedUrl!), {
        headers: { Accept: "application/json" },
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {});
        throw Error("Update feed unavailable");
      }
      const reader = response.body.getReader(),
        parts: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 131072) throw Error("Update feed too large");
          parts.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      const feed = releaseFeed.parse(
        JSON.parse(Buffer.concat(parts).toString("utf8")),
      );
      if (closed) throw Error("Update service closed");
      cached = feed;
      cachedAt = ports.clock();
      return feed;
    })().finally(() => {
      pending = null;
      controller = null;
    });
    return pending;
  }
  return {
    async check(target: UpdateTarget) {
      if (!ports.feedUrl)
        return { status: "not-configured" as const, current: target.version };
      try {
        if (closed) throw Error("Update service closed");
        return selectRelease(await load(), target);
      } catch {
        return { status: "unavailable" as const, current: target.version };
      }
    },
    async close() {
      closed = true;
      controller?.abort();
      await pending?.catch(() => {});
      cached = null;
    },
  };
}
export type UpdateService = ReturnType<typeof updateService>;
