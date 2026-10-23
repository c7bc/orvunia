import { join } from "node:path";
import type { NativeContext } from "./application-types.ts";
import type { NativeLayout } from "./application-layout.ts";
import type { createNativeWindowFactory } from "./application-window.ts";
import type { createNativeGaze } from "./native-gaze.ts";
import { nativeLocale, saveNativeState } from "./application-state.ts";
import { floatingWindowOptions, constrainFloatingWindow } from "./floating-window.ts";
export function createNativeViews(
  context: NativeContext,
  layout: NativeLayout,
  make: ReturnType<typeof createNativeWindowFactory>,
  gaze: () => ReturnType<typeof createNativeGaze>,
) {
  function tray() {
    if (!context.tray) return;
    context.tray.setContextMenu(
      context.electron.Menu.buildFromTemplate([
        {
          label: nativeLocale(
            context,
            "Abrir painel",
            "Open dashboard",
            "Abrir panel",
          ),
          click: () => layout.show(context.panel),
        },
        {
          label: nativeLocale(
            context,
            "Mostrar / ocultar assistente",
            "Show / hide assistant",
            "Mostrar / ocultar asistente",
          ),
          click: layout.toggle,
        },
        {
          label: nativeLocale(
            context,
            "Perto da câmera",
            "Near the camera",
            "Cerca de la cámara",
          ),
          click: () => layout.position("camera"),
        },
        { type: "separator" },
        {
          label: nativeLocale(context, "Sair", "Quit", "Salir"),
          click: () => context.electron.app.quit(),
        },
      ]),
    );
  }
  function open() {
    const { screen, Menu, Tray, nativeImage } = context.electron;
    context.panel = make("panel", {
      width: 1050,
      height: 700,
      minWidth: 800,
      minHeight: 600,
    });
    const area = screen.getPrimaryDisplay().workArea,
      bounds = layout.clamp({
        width: 540,
        height: 152,
        x:
          context.settings.bounds?.x ??
          area.x + Math.round((area.width - 540) / 2),
        y: context.settings.bounds?.y ?? area.y + 90,
      });
    context.overlay = make("overlay", {
      ...bounds,
      ...floatingWindowOptions("overlay"),
    });
    context.control = make("control", {
      width: 166,
      height: 50,
      ...floatingWindowOptions("control"),
    });
    constrainFloatingWindow(context.overlay, () => [540, context.overlayHeight]);
    constrainFloatingWindow(context.control, () => [166, 50]);
    for (const name of ["move", "resize"] as const)
      context.overlay.on(name, () => {
        layout.align();
        if (!gaze().status().enabled)
          context.settings.bounds = layout.remember();
      });
    for (const name of ["moved", "resized"] as const)
      context.overlay.on(name, () => {
        if (!gaze().status().enabled) saveNativeState(context);
      });
    context.control.on("moved", () => {
      layout.moveFromControl();
      if (!gaze().status().enabled) saveNativeState(context);
    });
    context.panel.once("ready-to-show", () => layout.show(context.panel));
    Menu.setApplicationMenu(null);
    if (!context.backgroundSmoke) {
      context.tray = new Tray(
        nativeImage.createFromPath(join(context.root, "assets/icon.png")),
      );
      context.tray.setToolTip("Orvunia");
      tray();
      context.tray.on("click", () => layout.show(context.panel));
    }
  }
  return { open, tray };
}
export type NativeViews = ReturnType<typeof createNativeViews>;
