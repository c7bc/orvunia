import type { Point } from "./contracts";
import type { GazeWorkerScope } from "./worker-scope";
import { extractGazeFeatures } from "./features";
type Landmarker = {
  detectForVideo(
    frame: ImageBitmap,
    timestamp: number,
  ): { faceLandmarks?: Point[][] };
  close(): void;
};
function bitmap(value: unknown): value is ImageBitmap {
  return Boolean(
    value &&
    typeof value === "object" &&
    "close" in value &&
    typeof value.close === "function" &&
    "width" in value &&
    typeof value.width === "number" &&
    "height" in value &&
    typeof value.height === "number",
  );
}
export function installGazeWorker(
  scope: GazeWorkerScope,
  load: () => Promise<Landmarker>,
) {
  let landmarker: Landmarker | null = null,
    loading: Promise<void> | null = null,
    stopped = false;
  scope.onmessage = async (event) => {
    const message = event.data;
    if (
      !message ||
      typeof message !== "object" ||
      !("type" in message) ||
      stopped
    )
      return;
    try {
      if (message.type === "init") {
        if (!loading)
          loading = load().then((value) => {
            if (stopped) {
              value.close();
              return;
            }
            landmarker = value;
            scope.postMessage({ type: "ready" });
          });
        await loading;
        return;
      }
      if (message.type === "frame") {
        const frame = "frame" in message ? message.frame : null;
        try {
          if (!landmarker) throw Error("Modelo ainda não iniciado.");
          if (
            !bitmap(frame) ||
            !("timestamp" in message) ||
            typeof message.timestamp !== "number" ||
            !Number.isFinite(message.timestamp)
          )
            throw Error("Frame local inválido.");
          const result = landmarker.detectForVideo(frame, message.timestamp),
            signal = extractGazeFeatures(
              result.faceLandmarks?.[0],
              frame.width,
              frame.height,
            );
          scope.postMessage({
            type: "result",
            id: "id" in message ? message.id : null,
            timestamp: message.timestamp,
            signal,
          });
        } finally {
          if (bitmap(frame)) frame.close();
        }
      }
      if (message.type === "stop") {
        stopped = true;
        landmarker?.close();
        landmarker = null;
        scope.close();
      }
    } catch (error) {
      if (!stopped)
        scope.postMessage({
          type: "error",
          id: "id" in message ? message.id : null,
          message:
            error instanceof Error
              ? error.message
              : "Falha ao executar o modelo local.",
        });
    }
  };
}
