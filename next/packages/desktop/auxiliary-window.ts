import { join } from "node:path";
import { createHash } from "node:crypto";
import type { NativeContext } from "./application-types.ts";
import { secureNativeNavigation } from "./native-security.ts";
import { nativeLocale } from "./application-state.ts";

export function createAuxiliaryWindow(context: NativeContext, dismiss: () => void) {
  const window = new context.electron.BrowserWindow({
    title: nativeLocale(context, "Orvunia — Opções", "Orvunia — Options", "Orvunia — Opciones"),
    icon: join(context.root, "assets/icon.ico"), show: false, frame: false,
    transparent: true, backgroundColor: "#00000000", hasShadow: false,
    skipTaskbar: true, resizable: false, width: 480, height: 400,
    webPreferences: { preload: join(context.desktopDirectory, "preload-auxiliary.cjs"),
      sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      ...(context.deployment === "cloud" ? { partition: "persist:cadence-cloud-"
        + createHash("sha256").update(context.remoteURL!).digest("hex").slice(0, 16) } : {}) },
  });
  window.setAlwaysOnTop(true, "screen-saver");
  window.setContentProtection(context.settings.protected);
  secureNativeNavigation(window.webContents, () => context.origin);
  window.on("page-title-updated", event => event.preventDefault());
  window.on("close", event => { if (!context.quitting) { event.preventDefault(); dismiss(); } });
  return window;
}
