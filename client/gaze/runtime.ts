import type { Point } from "./contracts";
import type { GazeBrowser } from "./browser";
export type GazeStage =
  | "off"
  | "loading"
  | "permission"
  | "calibrating"
  | "activating"
  | "tracking"
  | "preview"
  | "paused"
  | "stopped";
export type GazeState = {
  enabled: boolean;
  cameraActive: boolean;
  nativeEnabled: boolean;
  stage: GazeStage;
  calibrated: boolean;
  faceFound: boolean;
  error: string;
  rmse: number | null;
  point: Point | null;
  hardwareValidated: false;
};
export type NativeGaze = {
  gaze?(input: { enabled: boolean } | Point): unknown | Promise<unknown>;
};
export type GazeOptions = {
  native?: NativeGaze;
  browser?: GazeBrowser;
  onState?(state: GazeState & { nativeFollowing: boolean }): void;
  toast?(message: string): void;
  onRendered?(element: HTMLElement): void;
};
export function gazeRuntime(
  browser: GazeBrowser,
  options: GazeOptions,
  stop: (reason?: string) => void,
) {
  let lastNotify = 0;
  const state: GazeState = {
    enabled: false,
    cameraActive: false,
    nativeEnabled: false,
    stage: "off",
    calibrated: false,
    faceFound: false,
    error: "",
    rmse: null,
    point: null,
    hardwareValidated: false,
  };
  const runtime = {
    browser,
    options,
    state,
    generation: 0,
    nativeFollowing: () => typeof options.native?.gaze === "function",
    status: () => ({
      ...runtime.state,
      point: runtime.state.point ? { ...runtime.state.point } : null,
      nativeFollowing: runtime.nativeFollowing(),
    }),
    emit(force = false) {
      const time = browser.now();
      if (force || time - lastNotify > 250) {
        lastNotify = time;
        options.onState?.(runtime.status());
      }
    },
    fail(message: string) {
      stop(message);
      options.toast?.(message);
    },
  };
  return runtime;
}
export type GazeRuntime = ReturnType<typeof gazeRuntime>;
export function gazeError(error: unknown, fallback = "") {
  return error instanceof Error ? error.message || fallback : fallback;
}
