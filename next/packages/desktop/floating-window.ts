import type { NativeWindowOptions, PlatformWindow } from "./platform-window.ts";

export function floatingWindowOptions(
  kind: "overlay" | "control",
): NativeWindowOptions {
  const width = kind === "overlay" ? 540 : 166;
  return {
    useContentSize: true,
    thickFrame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minWidth: width,
    maxWidth: width,
    minHeight: kind === "overlay" ? 140 : 50,
    maxHeight: kind === "overlay" ? 720 : 50,
    skipTaskbar: true,
    alwaysOnTop: true,
  };
}

type FloatingWindow = Pick<
  PlatformWindow,
  | "on"
  | "isDestroyed"
  | "isMaximized"
  | "unmaximize"
  | "getContentSize"
  | "setContentSize"
>;

export function constrainFloatingWindow(
  window: FloatingWindow,
  size: () => readonly [number, number],
) {
  let restoring = false;
  function restore() {
    if (restoring || window.isDestroyed()) return;
    restoring = true;
    try {
      if (window.isMaximized()) window.unmaximize();
      const [width, height] = size();
      const [currentWidth, currentHeight] = window.getContentSize();
      // Fractional display scaling can round a native dimension by one DIP.
      if (
        Math.abs(currentWidth! - width) > 1 ||
        Math.abs(currentHeight! - height) > 1
      )
        window.setContentSize(width, height);
    } finally {
      restoring = false;
    }
  }
  // Native caption drags can request a Windows snap resize independently of CSS.
  window.on("will-resize", (event) => event.preventDefault());
  window.on("resize", restore);
  window.on("maximize", restore);
}
