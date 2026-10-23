import type { GazeBrowser } from "./browser";
export function waitForGaze<Value>(
  promise: Promise<Value>,
  signal: AbortSignal,
  browser: GazeBrowser,
  timeout: number,
  message: string,
  abandoned?: (value: Value) => void,
) {
  let timer: number | undefined;
  let abort: (() => void) | null = null;
  let accepting = true;
  return new Promise<Value>((resolve, reject) => {
    timer = browser.later(() => {
      accepting = false;
      reject(Error(message));
    }, timeout);
    abort = () => {
      accepting = false;
      reject(Error("Solicitação cancelada."));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(
      (value) => {
        if (accepting) {
          accepting = false;
          resolve(value);
        } else {
          try {
            abandoned?.(value);
          } catch {}
        }
      },
      (error) => {
        if (accepting) {
          accepting = false;
          reject(error);
        }
      },
    );
  }).finally(() => {
    browser.cancel(timer);
    if (abort) signal.removeEventListener("abort", abort);
  });
}
