import type { DiagnosticClock, DiagnosticOptions } from "./contracts";
export function diagnosticPlatform(options: DiagnosticOptions) {
  const supplied = options.clock ?? {},
    timer =
      supplied.setTimeout ??
      ((callback, delay) => globalThis.setTimeout(callback, delay)),
    clear =
      supplied.clearTimeout ??
      ((identifier) => globalThis.clearTimeout(identifier)),
    now = supplied.now ?? (() => globalThis.performance?.now() ?? Date.now());
  const clock: DiagnosticClock = {
    setTimeout: timer,
    clearTimeout: clear,
    now,
    requestAnimationFrame:
      supplied.requestAnimationFrame ??
      globalThis.requestAnimationFrame?.bind(globalThis) ??
      ((callback) => timer(() => callback(now()), 16)),
    cancelAnimationFrame:
      supplied.cancelAnimationFrame ??
      globalThis.cancelAnimationFrame?.bind(globalThis) ??
      clear,
  };
  return {
    clock,
    media: options.mediaDevices ?? globalThis.navigator?.mediaDevices,
    context:
      options.AudioContext ??
      globalThis.AudioContext ??
      (
        globalThis as typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext,
    lifecycle: options.lifecycle ?? globalThis.window,
  };
}
