import type { Point, GazeSignal } from "./contracts";
import { clamp, distance, midpoint } from "./geometry";
// Indices follow the official 478-point MediaPipe Face Mesh / iris topology.
export function extractGazeFeatures(
  landmarks: readonly Point[] | null | undefined,
  width = 640,
  height = 480,
): GazeSignal | null {
  if (
    !Array.isArray(landmarks) ||
    landmarks.length < 478 ||
    !(width > 0 && height > 0)
  )
    return null;
  const point = (index: number) => {
    const p = landmarks[index];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? { x: p.x * width, y: p.y * height }
      : null;
  };
  const eye = (
    aIndex: number,
    bIndex: number,
    topIndex: number,
    bottomIndex: number,
    irisIndex: number,
  ) => {
    let a = point(aIndex),
      b = point(bIndex);
    const top = point(topIndex),
      bottom = point(bottomIndex),
      iris = point(irisIndex);
    if (!a || !b || !top || !bottom || !iris) return null;
    if (a.x > b.x) [a, b] = [b, a];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (length < 15) return null;
    const openness = distance(top, bottom) / length;
    if (openness < 0.1 || openness > 0.6) return null;
    const center = midpoint(a, b),
      x = ((iris.x - a.x) * dx + (iris.y - a.y) * dy) / (length * length),
      y =
        ((iris.x - center.x) * -dy + (iris.y - center.y) * dx) /
        (length * length);
    if (x < 0.08 || x > 0.92 || Math.abs(y) > 0.4) return null;
    return { x: x - 0.5, y, center, length, openness };
  };
  const left = eye(33, 133, 159, 145, 468),
    right = eye(362, 263, 386, 374, 473),
    nose = point(1),
    forehead = point(10),
    chin = point(152);
  if (!left || !right || !nose || !forehead || !chin) return null;
  const eyeSpan = distance(left.center, right.center),
    faceHeight = distance(forehead, chin);
  if (eyeSpan < 45 || faceHeight < 90) return null;
  const center = midpoint(left.center, right.center);
  if (
    center.x < width * 0.1 ||
    center.x > width * 0.9 ||
    center.y < height * 0.1 ||
    center.y > height * 0.85
  )
    return null;
  const yaw = (nose.x - center.x) / eyeSpan,
    pitch = (nose.y - center.y) / faceHeight,
    roll = Math.atan2(
      right.center.y - left.center.y,
      right.center.x - left.center.x,
    );
  if (Math.abs(yaw) > 0.5 || Math.abs(roll) > 0.45) return null;
  return {
    features: [
      left.x,
      left.y,
      right.x,
      right.y,
      yaw,
      pitch,
      roll,
      center.x / width,
      center.y / height,
      eyeSpan / width,
    ],
    quality:
      clamp(Math.min(left.openness, right.openness) / 0.18) *
      clamp(eyeSpan / 80),
  };
}
