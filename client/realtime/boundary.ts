import type { RealtimeAudio } from "./recorder";
import type { BoundaryOptions } from "../audio/contracts";

export function waitPacket(
  state: RealtimeAudio,
  key: string,
  send: () => void,
  { signal, timeoutMs = 10000 }: BoundaryOptions,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Interrupted", "AbortError"));
      return;
    }
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      state.waiters.delete(key);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new DOMException("Interrupted", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          Error("A transcrição ainda não foi concluída. Tente novamente."),
        ),
      timeoutMs,
    );
    state.waiters.set(key, { resolve: () => finish(), reject: finish });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      send();
    } catch (error) {
      finish(error);
    }
  });
}
export async function flushBoundary(
  state: RealtimeAudio,
  options: BoundaryOptions,
) {
  const { timeoutMs = 10000 } = options;
  if (state.error) throw state.error;
  const processor = state.processor,
    socket = state.ws;
  if ((!processor && !state.nativeCapture) || !socket || !state.platform.open(socket))
    throw Error("A escuta foi desconectada. Ative-a novamente.");
  if (!state.supportsFlush)
    throw Error(
      "Atualize o servidor para concluir a transcrição antes de responder.",
    );
  const id = state.platform.identifier(),
    started = state.platform.clock();
  const remaining = () => ({
    ...options,
    timeoutMs: Math.max(1, timeoutMs - (state.platform.clock() - started)),
  });
  if (state.nativeCapture) await state.nativeCapture.flush(remaining());
  else await state.waitPacket(
    "local:" + id,
    () => processor!.port.postMessage({ type: "flush", id }),
    { ...options, timeoutMs: Math.min(2000, timeoutMs) },
  );
  const watermark = state.confirmation.sent;
  state.confirmation.flushing(id);
  await state.waitPacket(
    "server:" + id,
    () => socket.send(JSON.stringify({ type: "flush", id })),
    remaining(),
  );
  await state.waitPacket(
    "delivery:" + id,
    () => {
      void state.deliveries.then(
        () => state.waiters.get("delivery:" + id)?.resolve(),
        (error: unknown) => state.waiters.get("delivery:" + id)?.reject(error),
      );
    },
    remaining(),
  );
  if (state.error) throw state.error;
  state.confirmation.confirm(watermark);
}
