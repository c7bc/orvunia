import type { Point } from "./contracts";
import { clamp } from "./geometry";
export class GazeSmoother {
  value: Point | null = null;
  time = 0;
  readonly timeConstant: number;
  readonly maxSpeed: number;
  readonly deadzone: number;
  constructor({ timeConstant = 180, maxSpeed = 1.5, deadzone = 0.012 } = {}) {
    this.timeConstant = timeConstant;
    this.maxSpeed = maxSpeed;
    this.deadzone = deadzone;
    this.reset();
  }
  reset() {
    this.value = null;
    this.time = 0;
  }
  update(point: Point | null | undefined, time: number) {
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(time)
    )
      return null;
    const target = { x: clamp(point.x), y: clamp(point.y) };
    if (!this.value || time - this.time > 1000) {
      this.value = target;
      this.time = time;
      return { ...target };
    }
    const dt = clamp(time - this.time, 1, 250),
      alpha = 1 - Math.exp(-dt / this.timeConstant),
      dx = target.x - this.value.x,
      dy = target.y - this.value.y,
      distance = Math.hypot(dx, dy);
    if (distance > this.deadzone) {
      const fraction = Math.min(
        alpha,
        (this.maxSpeed * dt) / 1000 / Math.max(distance, 1e-6),
      );
      this.value = {
        x: clamp(this.value.x + dx * fraction),
        y: clamp(this.value.y + dy * fraction),
      };
    }
    this.time = time;
    return { ...this.value };
  }
}
