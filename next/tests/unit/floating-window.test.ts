import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import {
  constrainFloatingWindow,
  floatingWindowOptions,
} from "../../packages/desktop/floating-window.ts";

class WindowFixture extends EventEmitter {
  size = [166, 50];
  maximized = false;
  destroyed = false;
  writes = 0;
  isDestroyed = () => this.destroyed;
  isMaximized = () => this.maximized;
  getContentSize = () => this.size;
  unmaximize() {
    this.maximized = false;
    this.emit("resize");
  }
  setContentSize(width: number, height: number) {
    if (++this.writes > 3) throw Error("Recursive native sizing");
    this.size = [width, height];
    this.emit("resize");
  }
}

test("floating controls have fixed content bounds and cannot maximize or enter fullscreen", () => {
  expect(floatingWindowOptions("control")).toMatchObject({
    minWidth: 166, maxWidth: 166, minHeight: 50, maxHeight: 50,
    resizable: false, maximizable: false, fullscreenable: false,
    useContentSize: true,
  });
  expect(floatingWindowOptions("overlay")).toMatchObject({
    minWidth: 540, maxWidth: 540, minHeight: 140, maxHeight: 720,
    resizable: false, maximizable: false, fullscreenable: false,
  });
});

test("native resize requests are cancelled and unexpected enlargement repairs itself without recursion", () => {
  const window = new WindowFixture();
  constrainFloatingWindow(window, () => [166, 50]);
  window.size = [167, 51];
  window.emit("resize");
  expect(window.writes).toBe(0);
  let prevented = false;
  window.emit("will-resize", { preventDefault: () => { prevented = true; } });
  expect(prevented).toBe(true);
  window.size = [1920, 1080];
  window.emit("resize");
  expect(window.size).toEqual([166, 50]);
  expect(window.writes).toBe(1);
  window.emit("resize");
  expect(window.writes).toBe(1);
  window.maximized = true;
  window.size = [1920, 1080];
  window.emit("maximize");
  expect(window.maximized).toBe(false);
  expect(window.size).toEqual([166, 50]);
});

test("overlay height remains driven by application content and destroyed windows are ignored", () => {
  const window = new WindowFixture();
  window.size = [540, 152];
  let height = 152;
  constrainFloatingWindow(window, () => [540, height]);
  height = 640;
  window.setContentSize(540, height);
  expect(window.size).toEqual([540, 640]);
  expect(window.writes).toBe(1);
  window.size = [1200, 900];
  window.emit("resize");
  expect(window.size).toEqual([540, 640]);
  window.destroyed = true;
  window.emit("resize");
  expect(window.writes).toBe(2);
});
