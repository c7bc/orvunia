import type { PlatformWindow } from "./platform-window.ts";
import type { WindowBounds } from "./gaze-types.ts";
import type { NativeContext, NativeWindowMotion } from "./application-types.ts";
import type { createNativeGaze } from "./native-gaze.ts";
import {
  clampNativeBounds,
  nativeControlBounds,
  nativePosition,
  nativePositionTarget,
  nativeOverlayHeight,
} from "./window-geometry.ts";
import {
  nativeWindows,
  requireNativeWindow,
  saveNativeState,
} from "./application-state.ts";

export function createNativeLayout(
  context: NativeContext,
  motion: NativeWindowMotion,
  ports: {
    gaze(): ReturnType<typeof createNativeGaze>;
    changed(): void;
  },
) {
  let alignedControl: { x: number; y: number } | null = null;
  function show(window: PlatformWindow | null, inactive = false) {
    if (context.backgroundSmoke) {
      context.blockedDisplayRequests++;
      return;
    }
    motion.show(window, inactive);
  }
  const hide = (window: PlatformWindow | null) => motion.hide(window);
  const clamp = (bounds: WindowBounds) =>
    clampNativeBounds(
      bounds,
      context.electron.screen.getDisplayMatching(bounds).workArea,
    );
  function remember() {
    const overlay = requireNativeWindow(context, "overlay"),
      bounds = overlay.getBounds(),
      size = overlay.getContentSize();
    return { ...bounds, width: size[0]!, height: size[1]! };
  }
  function align() {
    if (!context.overlay || !context.control) return;
    const point = clamp(nativeControlBounds(context.overlay.getBounds()));
    alignedControl = point;
    const current = context.control.getBounds();
    if (current.x !== point.x || current.y !== point.y)
      context.control.setPosition(point.x, point.y);
  }
  function moveFromControl() {
    if (!context.overlay || !context.control) return;
    const control = context.control.getBounds();
    if (control.x === alignedControl?.x && control.y === alignedControl.y) return;
    const overlay = context.overlay.getBounds();
    const target = clamp({
      ...overlay,
      x: control.x - Math.round((overlay.width - 166) / 2),
      y: control.y + 54,
    });
    if (target.x !== overlay.x || target.y !== overlay.y)
      context.overlay.setPosition(target.x, target.y);
    align();
  }
  function position(value: unknown) {
    if (!context.overlay) return;
    const selected = nativePosition(value);
    if (ports.gaze().status().enabled) ports.gaze().stop();
    const bounds = context.overlay.getBounds(),
      cursor = context.electron.screen.getCursorScreenPoint(),
      area = context.electron.screen.getDisplayNearestPoint(cursor).workArea;
    const target = clamp(nativePositionTarget(selected, bounds, cursor, area));
    context.overlay.setPosition(target.x, target.y);
    show(context.overlay, true);
    align();
    context.settings.bounds = remember();
    saveNativeState(context);
    ports.changed();
  }
  function apply() {
    if (context.auxiliaryWindow && !context.auxiliaryWindow.isDestroyed())
      context.auxiliaryWindow.setContentProtection(context.settings.protected);
    for (const window of nativeWindows(context)) {
      window.setContentProtection(context.settings.protected);
      if (context.backgroundSmoke) {
        window.setFocusable(false);
        window.setAlwaysOnTop(false);
      }
      if (window !== context.panel) {
        window.setSkipTaskbar(true);
        if (!context.backgroundSmoke)
          window.setAlwaysOnTop(true, "screen-saver");
        window.setOpacity(1);
        if (
          !context.backgroundSmoke &&
          window.isFocusable() === context.settings.noFocus
        )
          window.setFocusable(!context.settings.noFocus);
        window.setIgnoreMouseEvents(context.settings.clickthrough, {
          forward: true,
        });
        window.setContentSize(
          window === context.overlay ? 540 : 166,
          window === context.overlay ? context.overlayHeight : 50,
        );
      }
    }
    ports.changed();
  }
  function toggle() {
    const overlay = requireNativeWindow(context, "overlay");
    if (overlay.isVisible() && !motion.isHiding(overlay)) {
      void hide(overlay);
      void hide(context.control);
    } else {
      show(overlay, true);
      show(context.control, true);
    }
    ports.changed();
  }
  function resize(value: unknown) {
    if (!value || typeof value !== "object") throw Error("Dimensão inválida.");
    const overlay = requireNativeWindow(context, "overlay"),
      height = nativeOverlayHeight(
        (value as Record<string, unknown>).height,
        context.electron.screen.getDisplayMatching(overlay.getBounds()).workArea
          .height,
      );
    context.overlayHeight = height;
    const [width, previous] = overlay.getContentSize();
    if (width !== 540 || Math.abs(previous! - height) > 1) {
      overlay.setContentSize(540, height);
      align();
    }
    return { width: 540, height };
  }
  function ambient(enabled: boolean) {
    if (context.active) return;
    if (enabled) {
      show(context.overlay, true);
      show(context.control, true);
      align();
    } else {
      void hide(context.overlay);
      void hide(context.control);
    }
  }
  return {
    show,
    hide,
    clamp,
    remember,
    align,
    moveFromControl,
    position,
    apply,
    toggle,
    resize,
    ambient,
  };
}
export type NativeLayout = ReturnType<typeof createNativeLayout>;
