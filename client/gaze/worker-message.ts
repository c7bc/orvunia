import type { Features, GazeSignal } from "./contracts";
type WorkerMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "result"; signal: GazeSignal | null; timestamp: number };
function signal(value: unknown): GazeSignal | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("quality" in value) ||
    !("features" in value)
  )
    return null;
  if (
    typeof value.quality !== "number" ||
    !Number.isFinite(value.quality) ||
    value.quality < 0 ||
    value.quality > 1 ||
    !Array.isArray(value.features) ||
    value.features.length !== 10 ||
    !value.features.every(
      (item) => typeof item === "number" && Number.isFinite(item),
    )
  )
    return null;
  return { quality: value.quality, features: value.features as Features };
}
export function gazeWorkerMessage(input: unknown): WorkerMessage | null {
  if (!input || typeof input !== "object" || !("type" in input)) return null;
  if (input.type === "ready") return { type: "ready" };
  if (
    input.type === "error" &&
    "message" in input &&
    typeof input.message === "string" &&
    input.message.length <= 2000
  )
    return { type: "error", message: input.message };
  if (
    input.type === "result" &&
    "timestamp" in input &&
    typeof input.timestamp === "number" &&
    Number.isFinite(input.timestamp) &&
    "signal" in input
  )
    return {
      type: "result",
      signal: signal(input.signal),
      timestamp: input.timestamp,
    };
  return null;
}
