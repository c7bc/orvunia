import { ProviderError } from "./domain.ts";

export async function* sseEvents(response: Response) {
  if (!response.body) throw new ProviderError("provider_unavailable");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      total += value?.byteLength ?? 0;
      if (total > 16 * 1024 * 1024)
        throw new ProviderError("provider_unavailable");
      pending += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const record = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        if (Buffer.byteLength(record, "utf8") > 512 * 1024)
          throw new ProviderError("provider_unavailable");
        const data = record
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield data;
      }
      if (Buffer.byteLength(pending, "utf8") > 512 * 1024)
        throw new ProviderError("provider_unavailable");
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
