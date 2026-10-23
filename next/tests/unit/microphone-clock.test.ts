import { expect, test } from "bun:test";
import { diagnosticPlatform } from "../../../client/microphone/browser.ts";

test("microphone diagnostics use browser timer identifiers without inheriting server timer handles", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const calls: unknown[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout(callback: () => void, delay: number) { calls.push(delay); callback(); return 41; },
    clearTimeout(identifier: number) { calls.push(identifier); },
  } });
  try {
    const { clock } = diagnosticPlatform({});
    const identifier = clock.setTimeout(() => calls.push("elapsed"), 20);
    expect(identifier).toBe(41);
    clock.clearTimeout(identifier);
    expect(calls).toEqual([20, "elapsed", 41]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("injected diagnostic clocks work without a browser window", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Reflect.deleteProperty(globalThis, "window");
  const cleared: number[] = [];
  try {
    const { clock } = diagnosticPlatform({ clock: {
      setTimeout: () => 53, clearTimeout: identifier => cleared.push(identifier), now: () => 12,
    } });
    const identifier = clock.setTimeout(() => {}, 20);
    clock.clearTimeout(identifier);
    expect(identifier).toBe(53);
    expect(cleared).toEqual([53]);
    expect(clock.now()).toBe(12);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
  }
});
