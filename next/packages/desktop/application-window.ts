import { join } from "node:path";
import { createHash } from "node:crypto";
import type { NativeWindowOptions } from "./platform-window.ts";
import type { NativeContext } from "./application-types.ts";
import type { NativeLayout } from "./application-layout.ts";
import type { createNativeGaze } from "./native-gaze.ts";
import type { createRendererDrain } from "./renderer-drain.ts";
import { secureNativeNavigation } from "./native-security.ts";
import { nativeLocale } from "./application-state.ts";
export function createNativeWindowFactory(
  context: NativeContext,
  layout: NativeLayout,
  ports: {
    gaze(): ReturnType<typeof createNativeGaze>;
    drain: ReturnType<typeof createRendererDrain>;
    changed(): void;
    audioGone?(senderId: number): void;
  },
) {
  return (
    kind: "panel" | "overlay" | "control",
    options: NativeWindowOptions,
  ) => {
    const window = new context.electron.BrowserWindow({
      title:
        kind === "panel"
          ? nativeLocale(
              context,
              "Orvunia — Painel",
              "Orvunia — Dashboard",
              "Orvunia — Panel",
            )
          : kind === "overlay"
            ? nativeLocale(
                context,
                "Orvunia — Assistente",
                "Orvunia — Assistant",
                "Orvunia — Asistente",
              )
            : nativeLocale(
                context,
                "Orvunia — Controle",
                "Orvunia — Control",
                "Orvunia — Control",
              ),
      icon: join(context.root, "assets/icon.ico"),
      show: false,
      frame: false,
      backgroundColor: kind === "panel" ? "#fafafa" : "#00000000",
      transparent: kind !== "panel",
      hasShadow: kind === "panel",
      autoHideMenuBar: true,
      ...options,
      ...(context.backgroundSmoke
        ? {
            show: false,
            focusable: false,
            skipTaskbar: true,
            alwaysOnTop: false,
          }
        : {}),
      webPreferences: {
        preload: join(context.desktopDirectory, context.extension ? "preload.cjs" : "preload-personal.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        offscreen: context.backgroundSmoke,
        ...(context.deployment === "cloud"
          ? {
              partition:
                "persist:cadence-cloud-" +
                createHash("sha256")
                  .update(context.remoteURL!)
                  .digest("hex")
                  .slice(0, 16),
            }
          : {}),
      },
    });
    window.on("page-title-updated", (request) => request.preventDefault());
    secureNativeNavigation(window.webContents, () => context.origin);
    const forget = () => {
      ports.audioGone?.(window.webContents.id);
      ports.drain.forget(window.webContents);
      if (ports.gaze().status().sender === window.webContents.id)
        ports.gaze().stop();
    };
    window.webContents.on("render-process-gone", forget);
    window.webContents.on(
      "did-start-navigation",
      (_request, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) forget();
      },
    );
    void window.loadURL(`${context.origin}/desktop.html?view=${kind}`);
    window.on("close", (request) => {
      if (context.quitting) return;
      request.preventDefault();
      if (kind === "panel") window.hide();
      else void layout.hide(window);
      if (kind === "overlay") void layout.hide(context.control);
      ports.changed();
    });
    return window;
  };
}
