import { gazeBrowser } from "./browser";
import { gazeRuntime } from "./runtime";
import type { GazeOptions } from "./runtime";
import { calibrationOverlay } from "./overlay";
import { nativeGaze } from "./native";
import { gazeEstimate } from "./estimate";
import { gazeCapture } from "./capture";
import { renderGazeSettings } from "./render";
export function createGazeController(options: GazeOptions = {}) {
  let disposed = false;
  const browser = options.browser ?? gazeBrowser(),
    runtime = gazeRuntime(browser, options, stop),
    overlay = calibrationOverlay(runtime, stop),
    native = nativeGaze(runtime),
    estimate = gazeEstimate(runtime, overlay, native),
    capture = gazeCapture(runtime, overlay, estimate, stop);
  function stop(reason = "") {
    runtime.generation++;
    native.release();
    capture.release();
    estimate.reset();
    overlay.remove();
    Object.assign(runtime.state, {
      enabled: false,
      cameraActive: false,
      calibrated: false,
      faceFound: false,
      point: null,
      stage: reason ? "stopped" : "off",
      error: reason,
      rmse: null,
    });
    runtime.emit(true);
  }
  async function start() {
    if (!disposed) await capture.start();
  }
  async function calibrate() {
    if (disposed) return;
    if (!capture.active()) return start();
    estimate.begin();
  }
  function bind(root: HTMLElement | Document) {
    const abort = new AbortController();
    root.addEventListener(
      "click",
      (event) => {
        const button = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-gaze]",
        );
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.gaze === "start") void start();
        if (button.dataset.gaze === "stop") stop();
        if (button.dataset.gaze === "calibrate") void calibrate();
      },
      { signal: abort.signal },
    );
    return () => abort.abort();
  }
  const leaving = () => stop(),
    key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && overlay.active()) {
        event.preventDefault();
        stop();
      }
    },
    fullscreen = () => overlay.changed();
  browser.window.addEventListener("pagehide", leaving);
  browser.window.addEventListener("beforeunload", leaving);
  browser.document.addEventListener("keydown", key);
  browser.document.addEventListener("fullscreenchange", fullscreen);
  return {
    renderSettings: () =>
      renderGazeSettings(
        runtime.state,
        estimate.active(),
        runtime.nativeFollowing(),
      ),
    bind,
    start,
    stop,
    calibrate,
    status: runtime.status,
    dispose() {
      disposed = true;
      stop();
      browser.window.removeEventListener("pagehide", leaving);
      browser.window.removeEventListener("beforeunload", leaving);
      browser.document.removeEventListener("keydown", key);
      browser.document.removeEventListener("fullscreenchange", fullscreen);
    },
  };
}
