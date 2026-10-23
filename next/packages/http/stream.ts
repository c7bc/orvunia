import { errorResponse } from "./errors.ts";

export function eventStream(
  request: Request,
  run: (
    signal: AbortSignal,
    emit: (event: string, data: unknown) => void,
  ) => Promise<unknown>,
) {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, request.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stopHeartbeat = () => clearInterval(heartbeat);
  const stream = new ReadableStream<Uint8Array>(
    {
      start(output) {
        const write = (value: string) => {
          signal.throwIfAborted();
          const bytes = encoder.encode(value);
          if (closed || (output.desiredSize ?? 0) < bytes.byteLength) {
            controller.abort();
            throw Error("Stream consumer disconnected or exceeded its buffer");
          }
          output.enqueue(bytes);
        };
        const emit = (event: string, data: unknown) =>
          write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        heartbeat = setInterval(() => {
          try { write(": keep-alive\n\n"); }
          catch { stopHeartbeat(); controller.abort(); }
        }, 5000);
        heartbeat.unref();
        signal.addEventListener("abort", stopHeartbeat, { once: true });
        void run(signal, emit)
          .then((result) => emit("done", result))
          .catch(async (error: unknown) => {
            if (signal.aborted || closed) return;
            const response = errorResponse(error, request, crypto.randomUUID());
            const payload = (await response.json()) as {
              error: { code: string; message: string };
            };
            emit("error", { ...payload.error, status: response.status });
          })
          .catch(() => controller.abort())
          .finally(() => {
            stopHeartbeat();
            signal.removeEventListener("abort", stopHeartbeat);
            if (!closed) {
              closed = true;
              output.close();
            }
          });
      },
      cancel() {
        stopHeartbeat();
        signal.removeEventListener("abort", stopHeartbeat);
        closed = true;
        controller.abort();
      },
    },
    {
      highWaterMark: 8 * 1024 * 1024,
      size: (chunk) => chunk?.byteLength ?? 0,
    },
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
