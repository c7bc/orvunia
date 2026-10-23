import { expect, test } from "bun:test";
import { createNativeGaze } from "../../packages/desktop/native-gaze.ts";
import {
  gazeRequest,
  gazeTarget,
} from "../../packages/desktop/gaze-geometry.ts";
import type { WindowBounds } from "../../packages/desktop/gaze-types.ts";
function fixture() {
  let bounds = { x: 100, y: 100, width: 540, height: 500 },
    now = 0,
    destroyed = false;
  const moves: { x: number; y: number }[] = [],
    events: string[] = [];
  const window = {
    isDestroyed: () => destroyed,
    getBounds: () => ({ ...bounds }),
    setPosition(x: number, y: number) {
      moves.push({ x, y });
      bounds = { ...bounds, x, y };
    },
  };
  const controller = createNativeGaze({
    window: () => window,
    area: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
    clamp: (value) => value,
    clock: () => now,
    align: () => events.push("align"),
    restored: () => events.push("saved"),
    changed: () => events.push("changed"),
  });
  return {
    controller,
    moves,
    events,
    window,
    clock: (value: number) => {
      now = value;
    },
    destroy: () => {
      destroyed = true;
    },
  };
}
test("gaze tracking fences ownership, rate limits and restores the original position without showing or focusing", () => {
  const { controller, moves, events, window, clock } = fixture(),
    original = window.getBounds();
  expect(() => controller.move(1, { x: 0.5, y: 0.5 })).toThrow("Ative");
  expect(controller.move(1, { enabled: true })).toEqual({
    enabled: true,
    moved: false,
  });
  expect(() => controller.move(2, { x: 0.5, y: 0.5 })).toThrow("outra janela");
  expect(controller.move(1, { x: 0.7, y: 0.2 }).moved).toBe(true);
  clock(99);
  expect(controller.move(1, { x: 0.8, y: 0.3 })).toEqual({
    enabled: true,
    moved: false,
    rateLimited: true,
  });
  clock(100);
  expect(controller.move(1, { x: 0.8, y: 0.3 }).moved).toBe(true);
  controller.stop();
  expect(window.getBounds()).toEqual(original);
  expect(moves.length).toBe(3);
  expect(events.filter((value) => value === "saved").length).toBe(1);
  expect(controller.status()).toEqual({
    enabled: false,
    previous: null,
    lastMove: null,
    sender: null,
  });
  controller.stop();
  expect(moves.length).toBe(3);
});
test("invalid coordinates cannot enable or move a native window", () => {
  const { controller, moves } = fixture();
  for (const value of [
    null,
    [],
    {},
    { enabled: 1 },
    { x: 0.3 },
    { x: NaN, y: 0.2 },
    { x: 0.2, y: 2 },
    { enabled: false, x: 0.2, y: 0.3 },
    { enabled: true, extra: true },
  ])
    expect(() => controller.move(1, value)).toThrow();
  expect(controller.status().enabled).toBe(false);
  expect(moves.length).toBe(0);
  expect(gazeRequest({ enabled: false }).enabled).toBe(false);
});
test("gaze geometry bounds coordinates on negative and smaller displays, leaving space for controls", () => {
  for (const area of [
    { x: -1920, y: -200, width: 1280, height: 720 },
    { x: 100, y: 0, width: 400, height: 300 },
  ])
    for (const point of [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ]) {
      const bounds: WindowBounds = { x: 0, y: 0, width: 540, height: 500 },
        target = gazeTarget(bounds, area, point);
      expect(target.x).toBeGreaterThanOrEqual(area.x);
      expect(target.y).toBeGreaterThanOrEqual(area.y);
      expect(target.x).toBeLessThanOrEqual(
        area.x + Math.max(0, area.width - bounds.width),
      );
      expect(target.y).toBeLessThanOrEqual(
        area.y + Math.max(0, area.height - bounds.height),
      );
    }
});
test("a destroyed overlay releases gaze ownership without touching the native window", () => {
  const { controller, moves, destroy } = fixture();
  controller.move(1, { enabled: true });
  destroy();
  controller.stop();
  expect(moves.length).toBe(0);
  expect(controller.status().sender).toBeNull();
  expect(() => controller.move(1, { enabled: true })).toThrow("disponível");
});
