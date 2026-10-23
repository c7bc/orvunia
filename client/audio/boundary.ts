import type { BoundaryOptions } from "./contracts";

export function waitAudioBoundary(
  promise: Promise<void>,
  { signal, timeoutMs = 10_000 }: BoundaryOptions,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Interrupted", "AbortError"));
      return;
    }
    const abort = () => finish(new DOMException("Interrupted", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          Error("A transcrição ainda não foi concluída. Tente novamente."),
        ),
      timeoutMs,
    );
    function finish(error?: unknown) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    }
    signal?.addEventListener("abort", abort, { once: true });
    promise.then(() => finish(), finish);
  });
}
