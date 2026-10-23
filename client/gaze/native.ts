import type { GazeRuntime } from "./runtime";
import { gazeError } from "./runtime";
import type { Point } from "./contracts";
function refused(result: unknown) {
  if (result === false) return true;
  if (!result || typeof result !== "object") return false;
  if ("enabled" in result && result.enabled === false) return true;
  return (
    "gaze" in result &&
    result.gaze !== null &&
    typeof result.gaze === "object" &&
    "enabled" in result.gaze &&
    result.gaze.enabled === false
  );
}
export function nativeGaze(runtime: GazeRuntime) {
  let requested = false,
    generation = 0,
    lastSent = 0;
  const { browser, options } = runtime;
  function release() {
    const enabled = requested;
    requested = false;
    generation++;
    runtime.state.nativeEnabled = false;
    if (enabled && options.native?.gaze) {
      try {
        Promise.resolve(options.native.gaze({ enabled: false })).catch(
          () => {},
        );
      } catch {}
    }
  }
  async function acquire(run: number) {
    if (!options.native?.gaze) return;
    const lease = ++generation;
    requested = true;
    runtime.state.stage = "activating";
    runtime.emit(true);
    let timer: number | undefined;
    try {
      const result = await Promise.race([
        options.native.gaze({ enabled: true }),
        new Promise<never>((_, reject) => {
          timer = browser.later(
            () =>
              reject(
                Error(
                  "O acompanhamento nativo não respondeu em três segundos.",
                ),
              ),
            3000,
          );
        }),
      ]);
      if (run !== runtime.generation || lease !== generation) return;
      if (refused(result))
        throw Error("O aplicativo recusou a ativação do acompanhamento.");
      runtime.state.nativeEnabled = true;
      runtime.state.stage = "tracking";
      runtime.emit(true);
    } catch (error) {
      if (run === runtime.generation && lease === generation)
        runtime.fail(
          gazeError(error, "Não foi possível ativar o acompanhamento nativo."),
        );
    } finally {
      browser.cancel(timer);
    }
  }
  function point(value: Point, time: number) {
    if (
      !runtime.state.nativeEnabled ||
      !options.native?.gaze ||
      time - lastSent < 125
    )
      return;
    const run = runtime.generation;
    lastSent = time;
    Promise.resolve()
      .then(() => {
        if (run === runtime.generation && runtime.state.nativeEnabled)
          return options.native!.gaze!({ x: value.x, y: value.y });
      })
      .catch(() => {
        if (run === runtime.generation)
          runtime.fail(
            "Não foi possível reposicionar o assistente. O acompanhamento foi desligado.",
          );
      });
  }
  return { release, acquire, point };
}
export type NativeGazeController = ReturnType<typeof nativeGaze>;
