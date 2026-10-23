import { expect, test } from "bun:test";
import { createNativeLayout } from "../../packages/desktop/application-layout.ts";
import type { NativeContext, NativeWindowMotion } from "../../packages/desktop/application-types.ts";
import type { NativeLayout } from "../../packages/desktop/application-layout.ts";

function fixture() {
  const area = { x: -1920, y: 0, width: 1920, height: 1080 };
  let overlay = { x: -1200, y: 0, width: 540, height: 152 };
  let control = { x: -1013, y: 0, width: 166, height: 50 };
  let moves = 0;
  let layout: NativeLayout;
  const context = {
    electron: { screen: { getDisplayMatching: () => ({ workArea: area }) } },
    overlay: {
      getBounds: () => ({ ...overlay }),
      setPosition(x: number, y: number) {
        if (++moves > 4) throw Error("Recursive floating window movement");
        overlay = { ...overlay, x, y };
        layout.align();
      },
    },
    control: {
      getBounds: () => ({ ...control }),
      setPosition(x: number, y: number) {
        if (++moves > 4) throw Error("Recursive floating window movement");
        control = { ...control, x, y };
        layout.moveFromControl();
      },
    },
  } as unknown as NativeContext;
  layout = createNativeLayout(context, {} as NativeWindowMotion, {
    gaze: () => { throw Error("Movement must not activate gaze"); },
    changed: () => {},
  });
  return {
    layout, bounds: () => ({ overlay, control, moves }),
    moveOverlay(x: number, y: number) { overlay = { ...overlay, x, y }; },
    moveControl(x: number, y: number) { control = { ...control, x, y }; },
  };
}

test("programmatic control alignment is idempotent and does not displace an overlay clamped at the screen edge", () => {
  const current = fixture();
  current.layout.align();
  current.layout.moveFromControl();
  expect(current.bounds().overlay.y).toBe(0);
  expect(current.bounds().moves).toBe(0);
  current.moveOverlay(-1100, 120);
  current.layout.align();
  current.layout.align();
  expect(current.bounds().control).toMatchObject({ x: -913, y: 66 });
  expect(current.bounds().overlay).toMatchObject({ x: -1100, y: 120 });
  expect(current.bounds().moves).toBe(1);
});

test("dragging controls moves both surfaces within the work area without feedback loops", () => {
  const current = fixture();
  current.layout.align();
  current.moveControl(-700, 200);
  current.layout.moveFromControl();
  expect(current.bounds().overlay).toMatchObject({ x: -887, y: 254 });
  expect(current.bounds().moves).toBe(1);
  current.moveControl(-100, 2000);
  current.layout.moveFromControl();
  expect(current.bounds().overlay).toMatchObject({ x: -540, y: 928 });
  expect(current.bounds().control).toMatchObject({ x: -353, y: 874 });
  expect(current.bounds().moves).toBe(3);
});
