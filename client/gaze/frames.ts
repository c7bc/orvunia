import type { GazeRuntime } from "./runtime";
import type { GazeEstimate } from "./estimate";
import type { GazeSignal } from "./contracts";
import { waitForGaze } from "./wait";
export function gazeFrames(
  runtime: GazeRuntime,
  estimate: GazeEstimate,
  resources: {
    stream(): MediaStream | null;
    video(): HTMLVideoElement | null;
    worker(): Worker | null;
  },
) {
  let timer: number | undefined,
    frameTimer: number | undefined,
    inFlight = false,
    frameId = 0,
    lastFaceAt = 0,
    abort = new AbortController();
  const { browser } = runtime;
  function stop() {
    abort.abort();
    browser.cancel(timer);
    browser.cancel(frameTimer);
    timer = frameTimer = undefined;
    inFlight = false;
  }
  function receive(signal: GazeSignal | null, timestamp: number) {
    browser.cancel(frameTimer);
    inFlight = false;
    if (signal && signal.quality >= 0.65) lastFaceAt = browser.now();
    estimate.consume(signal, timestamp);
  }
  async function tick(run: number) {
    if (
      run !== runtime.generation ||
      !resources.stream() ||
      !resources.worker()
    )
      return;
    const deadline = estimate.deadline();
    if (browser.now() - lastFaceAt > 15000) {
      runtime.fail(
        "Os olhos ficaram fora de vista por 15 segundos. A câmera foi desligada.",
      );
      return;
    }
    if (
      deadline &&
      (browser.now() - deadline.pointStarted > 15000 ||
        browser.now() - deadline.started > 180000)
    ) {
      runtime.fail(
        "Não foi possível concluir a calibração. A câmera foi desligada; ajuste a luz e tente novamente.",
      );
      return;
    }
    try {
      const video = resources.video();
      if (!inFlight && video && video.readyState >= 2) {
        inFlight = true;
        const bitmap = await waitForGaze(
          browser.bitmap(video),
          abort.signal,
          browser,
          3000,
          "O processamento local demorou demais. A câmera foi desligada.",
          (value) => value.close(),
        );
        if (run !== runtime.generation) {
          bitmap.close();
          return;
        }
        try {
          resources.worker()!.postMessage(
            {
              type: "frame",
              id: ++frameId,
              frame: bitmap,
              timestamp: browser.now(),
            },
            [bitmap],
          );
        } catch (error) {
          bitmap.close();
          throw error;
        }
        frameTimer = browser.later(() => {
          if (run === runtime.generation)
            runtime.fail(
              "O processamento local demorou demais. A câmera foi desligada.",
            );
        }, 3000);
      }
    } catch {
      if (run === runtime.generation)
        runtime.fail(
          "Não foi possível processar a câmera local. O acompanhamento foi desligado.",
        );
      return;
    }
    if (run === runtime.generation)
      timer = browser.later(() => {
        void tick(run);
      }, 80);
  }
  return {
    stop,
    receive,
    start(run: number) {
      abort = new AbortController();
      lastFaceAt = browser.now();
      void tick(run);
    },
  };
}
