import { LocalModelError } from "./domain.ts";

export async function downloadActivity<T>(operation: () => Promise<T>, signal: AbortSignal,
  controller: AbortController, milliseconds: number): Promise<T> {
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => undefined;
  const interruption = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      const error = new LocalModelError("download_stalled", 504);
      reject(error);
      controller.abort(error);
    }, milliseconds);
  });
  try { return await Promise.race([operation(), interruption]); }
  finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

export function progressingBody(body: ReadableStream<Uint8Array>, signal: AbortSignal,
  controller: AbortController, milliseconds: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let released = false;
  const release = () => { if (!released) { released = true; reader.releaseLock(); } };
  return new ReadableStream<Uint8Array>({
    async pull(output) {
      try {
        const result = await downloadActivity(() => reader.read(), signal, controller, milliseconds);
        if (result.done) { output.close(); release(); }
        else output.enqueue(result.value);
      } catch (error) {
        controller.abort(error);
        await reader.cancel(error).catch(() => undefined);
        release(); output.error(error);
      }
    },
    async cancel(reason) {
      controller.abort(reason);
      try { await reader.cancel(reason); } finally { release(); }
    },
  }, { highWaterMark: 0 });
}
