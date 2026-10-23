import type { GazeModel, GazeSample, GazeSignal, Point } from "./contracts";
import type { GazeRuntime } from "./runtime";
import { gazeError } from "./runtime";
import type { CalibrationOverlay } from "./overlay";
import { calibrationTargets } from "./overlay";
import type { NativeGazeController } from "./native";
import { fitGazeCalibration, predictGaze } from "./calibration";
import { GazeSmoother } from "./smoother";
type Calibration = {
  index: number;
  samples: GazeSample[];
  all: GazeSample[];
  pointStarted: number;
  started: number;
  target: Point | null;
};
export function gazeEstimate(
  runtime: GazeRuntime,
  overlay: CalibrationOverlay,
  native: NativeGazeController,
) {
  let calibration: Calibration | null = null,
    model: GazeModel | null = null;
  const smoother = new GazeSmoother();
  function reset() {
    calibration = null;
    model = null;
    smoother.reset();
  }
  function draw(message: string) {
    overlay.draw(message, calibrationTargets[calibration?.index ?? 0]);
  }
  function begin() {
    native.release();
    model = null;
    smoother.reset();
    calibration = {
      index: 0,
      samples: [],
      all: [],
      pointStarted: runtime.browser.now(),
      started: runtime.browser.now(),
      target: null,
    };
    Object.assign(runtime.state, {
      stage: "calibrating",
      calibrated: false,
      point: null,
      rmse: null,
    });
    draw("Ponto 1 de 9 · Aguarde os olhos serem encontrados");
    overlay.enter();
    runtime.emit(true);
  }
  function sample(signal: GazeSignal) {
    const current = calibration;
    if (!current) return;
    const elapsed = runtime.browser.now() - current.pointStarted;
    current.target ??= overlay.onScreen(calibrationTargets[current.index]!);
    if (elapsed >= 650)
      current.samples.push({
        features: signal.features,
        target: current.target,
      });
    draw(
      `Ponto ${current.index + 1} de 9 · ${elapsed < 650 ? "Fixe o olhar no ponto" : `Coletando ${Math.min(18, current.samples.length)}/18`}`,
    );
    if (current.samples.length >= 18 && elapsed >= 1800) {
      current.all.push(...current.samples);
      current.samples = [];
      current.index++;
      if (current.index === calibrationTargets.length) {
        try {
          const fit = fitGazeCalibration(current.all);
          model = fit.model;
          calibration = null;
          Object.assign(runtime.state, {
            stage: runtime.nativeFollowing() ? "activating" : "preview",
            calibrated: true,
            rmse: fit.rmse,
          });
          overlay.remove();
          runtime.emit(true);
          void native.acquire(runtime.generation);
          runtime.options.toast?.(
            "Calibração concluída. Recalibre se mudar de posição ou câmera.",
          );
        } catch (error) {
          runtime.fail(gazeError(error));
        }
      } else {
        current.pointStarted = runtime.browser.now();
        current.target = null;
        draw(`Ponto ${current.index + 1} de 9 · Fixe o olhar`);
      }
    }
    runtime.emit();
  }
  function consume(signal: GazeSignal | null, time: number) {
    const good = Boolean(signal && signal.quality >= 0.65);
    runtime.state.faceFound = good;
    if (!good || !signal) {
      if (!calibration) runtime.state.stage = "paused";
      runtime.emit();
      return;
    }
    if (calibration) {
      sample(signal);
      return;
    }
    if (!model) return;
    const prediction = predictGaze(model, signal.features);
    if (
      !prediction ||
      prediction.x < -0.25 ||
      prediction.x > 1.25 ||
      prediction.y < -0.25 ||
      prediction.y > 1.25
    ) {
      runtime.state.stage = "paused";
      runtime.emit();
      return;
    }
    const point = smoother.update(prediction, time);
    runtime.state.point = point;
    runtime.state.stage = runtime.nativeFollowing()
      ? runtime.state.nativeEnabled
        ? "tracking"
        : "activating"
      : "preview";
    if (point) native.point(point, time);
    runtime.emit();
  }
  return {
    begin,
    reset,
    consume,
    active: () => calibration !== null,
    deadline: () =>
      calibration
        ? {
            pointStarted: calibration.pointStarted,
            started: calibration.started,
          }
        : null,
  };
}
export type GazeEstimate = ReturnType<typeof gazeEstimate>;
