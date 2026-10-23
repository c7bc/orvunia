import type { Point } from "./contracts";
export const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));
export const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y);
export const midpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});
