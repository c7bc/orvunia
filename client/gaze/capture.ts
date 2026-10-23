import type { GazeRuntime } from "./runtime";
import { gazeError } from "./runtime";
import type { CalibrationOverlay } from "./overlay";
import type { GazeEstimate } from "./estimate";
import { gazeWorker } from "./worker";
import type { GazeWorker } from "./worker";
import { gazeFrames } from "./frames";
import { waitForGaze } from "./wait";
import { releaseStream } from "./resources";
export function gazeCapture(
  runtime: GazeRuntime,
  overlay: CalibrationOverlay,
  estimate: GazeEstimate,
  stop: (reason?: string) => void,
) {
  const { browser } = runtime;
  let stream: MediaStream | null = null,
    video: HTMLVideoElement | null = null,
    worker: GazeWorker | null = null,
    abort = new AbortController();
  const frames = gazeFrames(runtime, estimate, {
    stream: () => stream,
    video: () => video,
    worker: () => worker?.worker ?? null,
  });
  function release() {
    abort.abort();
    frames.stop();
    releaseStream(stream);
    stream = null;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.remove();
      video = null;
    }
    try {
      worker?.close();
    } catch {}
    worker = null;
  }
  async function start() {
    if (runtime.state.enabled) return;
    if (!browser.supported()) {
      runtime.options.toast?.(
        "Este navegador não oferece câmera e processamento local compatíveis.",
      );
      return;
    }
    if (!browser.activeGesture()) {
      runtime.options.toast?.(
        "Clique em Ativar e calibrar para iniciar a câmera.",
      );
      return;
    }
    const run = ++runtime.generation;
    abort = new AbortController();
    const signal = abort.signal;
    Object.assign(runtime.state, {
      enabled: true,
      stage: "loading",
      error: "",
      rmse: null,
    });
    overlay.draw();
    overlay.enter();
    runtime.emit(true);
    try {
      const created = gazeWorker(runtime, run, frames.receive);
      worker = created;
      await created.ready;
      if (run !== runtime.generation) return;
      overlay.draw("Autorize a câmera para calibrar os olhos");
      runtime.state.stage = "permission";
      runtime.emit(true);
      const owned = await waitForGaze(
        browser.media(),
        signal,
        browser,
        30000,
        "A câmera não foi autorizada em 30 segundos.",
        releaseStream,
      );
      if (run !== runtime.generation) {
        releaseStream(owned);
        return;
      }
      stream = owned;
      const element = browser.document.createElement("video");
      video = element;
      element.muted = true;
      element.playsInline = true;
      element.className = "gaze-local-video";
      element.setAttribute("aria-hidden", "true");
      element.srcObject = owned;
      browser.document.body.append(element);
      await waitForGaze(
        element.play(),
        signal,
        browser,
        10000,
        "Não foi possível iniciar a câmera local.",
      );
      if (run !== runtime.generation) return;
      for (const track of owned.getVideoTracks())
        track.addEventListener(
          "ended",
          () => {
            if (run === runtime.generation) stop("A câmera foi desconectada.");
          },
          { once: true },
        );
      runtime.state.cameraActive = true;
      estimate.begin();
      frames.start(run);
    } catch (error) {
      if (run === runtime.generation)
        runtime.fail(
          error instanceof Error && error.name === "NotAllowedError"
            ? "A câmera não foi autorizada. O acompanhamento continua desligado."
            : gazeError(
                error,
                "Não foi possível iniciar o acompanhamento local.",
              ),
        );
    }
  }
  return { start, release, active: () => stream !== null };
}
