import type { DiagnosticOptions, DiagnosticState } from "./contracts";
import { diagnosticPlatform } from "./browser";
import { diagnosticError, diagnosticFailure } from "./errors";
import { emptyResources, releaseResources } from "./resources";
import { connectMicrophone } from "./connect";
import { startMeter } from "./meter";
export function createMicrophoneTest(options: DiagnosticOptions = {}) {
  const platform = diagnosticPlatform(options),
    { clock } = platform,
    timeout = options.timeoutMs ?? 12000,
    duration =
      Number.isFinite(timeout) && timeout > 0
        ? Math.min(timeout, 12000)
        : 12000;
  let resources = emptyResources(),
    generation = 0,
    disposed = false;
  let snapshot: DiagnosticState = {
    status: "idle",
    level: 0,
    reason: null,
    deviceId: "default",
  };
  const state = () => Object.freeze({ ...snapshot });
  function cleanup() {
    const held = resources;
    resources = emptyResources();
    releaseResources(held, clock);
  }
  function resetLevel() {
    try {
      options.onLevel?.(0, { rms: 0, elapsedMs: 0 });
    } catch {}
  }
  function fail(error: unknown) {
    generation++;
    cleanup();
    const mapped = diagnosticError(error);
    snapshot = { ...snapshot, status: "error", level: 0, reason: mapped.code };
    resetLevel();
    try {
      options.onError?.(mapped);
    } catch {}
    try {
      options.onState?.(state());
    } catch {}
    return false;
  }
  function publish() {
    try {
      options.onState?.(state());
      return true;
    } catch (error) {
      return fail(error);
    }
  }
  function stop(reason = "cancelled") {
    generation++;
    cleanup();
    snapshot = { ...snapshot, status: "stopped", level: 0, reason };
    resetLevel();
    try {
      options.onState?.(state());
    } catch {}
    return state();
  }
  async function start(
    deviceId = "default",
    { signal }: { signal?: AbortSignal } = {},
  ) {
    if (disposed)
      return fail(
        diagnosticFailure(
          "disposed",
          "Este teste de microfone já foi encerrado.",
        ),
      );
    generation++;
    cleanup();
    const token = generation,
      valid = () => token === generation;
    if (typeof deviceId !== "string" || deviceId.length > 200)
      return fail(
        diagnosticFailure("invalid_device", "Selecione um microfone válido."),
      );
    snapshot = {
      status: "requesting",
      level: 0,
      reason: null,
      deviceId: deviceId || "default",
    };
    if (signal?.aborted) {
      stop("aborted");
      return false;
    }
    if (!publish() || !valid()) return false;
    if (typeof platform.media?.getUserMedia !== "function")
      return fail(
        diagnosticFailure(
          "unsupported",
          "Seu navegador não permite testar o microfone.",
        ),
      );
    if (typeof platform.context !== "function")
      return fail(
        diagnosticFailure(
          "unsupported",
          "O processamento local de áudio não está disponível neste ambiente.",
        ),
      );
    const startedAt = clock.now();
    resources.timer = clock.setTimeout(() => {
      if (valid()) stop("timeout");
    }, duration);
    if (signal) {
      const abort = () => {
        if (valid()) stop("aborted");
      };
      signal.addEventListener("abort", abort, { once: true });
      resources.abort = () => signal.removeEventListener("abort", abort);
      if (signal.aborted) {
        stop("aborted");
        return false;
      }
    }
    try {
      const analyser = await connectMicrophone({
        media: platform.media,
        Context: platform.context,
        resources,
        deviceId,
        valid,
        stop,
      });
      if (!analyser || !valid()) return false;
      snapshot = { ...snapshot, status: "listening" };
      if (!publish() || !valid()) return false;
      startMeter({
        resources,
        analyser,
        clock,
        startedAt,
        valid,
        level: () => snapshot.level,
        update(level, details) {
          snapshot = { ...snapshot, level };
          options.onLevel?.(level, details);
        },
        fail,
      });
      return true;
    } catch (error) {
      return valid() ? fail(error) : false;
    }
  }
  const unload = () => {
    stop("unload");
  };
  platform.lifecycle?.addEventListener?.("beforeunload", unload);
  platform.lifecycle?.addEventListener?.("pagehide", unload);
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop("disposed");
    platform.lifecycle?.removeEventListener?.("beforeunload", unload);
    platform.lifecycle?.removeEventListener?.("pagehide", unload);
  }
  return {
    start,
    stop,
    dispose,
    get state() {
      return state();
    },
  };
}
