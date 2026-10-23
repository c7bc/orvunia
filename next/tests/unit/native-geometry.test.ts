import { expect, test } from "bun:test";
import {
  clampNativeBounds,
  nativePositionTarget,
  nativeControlBounds,
  nativeOverlayHeight,
} from "../../packages/desktop/window-geometry.ts";

test("window geometry retains camera, cursor, movement and minimum overlay sizing on negative and undersized monitors", () => {
  const area = { x: -1920, y: 0, width: 1920, height: 1080 },
    bounds = { x: -1000, y: 100, width: 540, height: 152 };
  expect(
    nativePositionTarget("camera", bounds, { x: -100, y: 0 }, area),
  ).toMatchObject({ x: -1230, y: 58 });
  expect(nativePositionTarget("right", bounds, { x: 0, y: 0 }, area).x).toBe(
    -965,
  );
  expect(clampNativeBounds({ ...bounds, x: 1 }, area).x).toBe(-540);
  expect(
    clampNativeBounds(bounds, { x: 0, y: 0, width: 100, height: 100 }),
  ).toMatchObject({ x: 0, y: 0 });
  expect(nativeControlBounds(bounds)).toMatchObject({ x: -813, y: 46 });
  expect(nativeOverlayHeight(900, 1080)).toBe(720);
  expect(nativeOverlayHeight(-10, 1080)).toBe(140);
  expect(nativeOverlayHeight(400, 200)).toBe(350);
  expect(() => nativeOverlayHeight(NaN, 1080)).toThrow("Dimensão");
});
