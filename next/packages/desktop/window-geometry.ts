import type { WindowBounds, GazePoint } from "./gaze-types.ts";
export type NativePosition =
  "camera" | "cursor" | "up" | "down" | "left" | "right";
export function nativePosition(value: unknown): NativePosition {
  if (
    value !== "camera" &&
    value !== "cursor" &&
    value !== "up" &&
    value !== "down" &&
    value !== "left" &&
    value !== "right"
  )
    throw Error("Posição inválida.");
  return value;
}
export function clampNativeBounds(
  bounds: WindowBounds,
  area: WindowBounds,
): WindowBounds {
  return {
    ...bounds,
    x: Math.round(
      Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width)),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(bounds.y, area.y + area.height - bounds.height),
      ),
    ),
  };
}
export function nativePositionTarget(
  position: NativePosition,
  bounds: WindowBounds,
  cursor: GazePoint,
  area: WindowBounds,
): WindowBounds {
  if (position === "camera")
    return {
      ...bounds,
      x: area.x + (area.width - bounds.width) / 2,
      y: area.y + 58,
    };
  if (position === "cursor")
    return { ...bounds, x: cursor.x - bounds.width / 2, y: cursor.y - 30 };
  return {
    ...bounds,
    x: bounds.x + (position === "left" ? -35 : position === "right" ? 35 : 0),
    y: bounds.y + (position === "up" ? -35 : position === "down" ? 35 : 0),
  };
}
export function nativeControlBounds(bounds: WindowBounds): WindowBounds {
  return {
    width: 166,
    height: 50,
    x: bounds.x + Math.round((bounds.width - 166) / 2),
    y: bounds.y - 54,
  };
}
export function nativeOverlayHeight(value: unknown, available: number) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw Error("Dimensão inválida.");
  const maximum = Math.max(350, Math.min(720, available - 90));
  return Math.round(Math.max(140, Math.min(maximum, value)));
}
