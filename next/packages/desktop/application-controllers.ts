import type { NativeContext } from "./application-types.ts";
import type { NativeLayout } from "./application-layout.ts";
import type { NativeViews } from "./application-views.ts";
import { createNativeGaze } from "./native-gaze.ts";
import { registerNativeShortcuts } from "./native-shortcuts.ts";
import { createNativePreferences } from "./native-preferences.ts";
import { saveNativePreferences } from "./preference-file.ts";
import { createNativeCapture } from "./native-capture.ts";
import { createNativeExport } from "./native-export.ts";
import { createNativeReminders } from "./native-reminders.ts";
import { createNativeSystemAudio } from "./system-audio/native.ts";
import { writeFileSync } from "node:fs";
import { nativeDistribution } from "./distribution.ts";
import {
  nativeEvent,
  nativeWindows,
  nativeLocale,
  saveNativeState,
} from "./application-state.ts";
export function createNativeControllers(
  context: NativeContext,
  layout: NativeLayout,
  views: NativeViews,
  closing: () => boolean,
) {
  const {
    app,
    globalShortcut,
    desktopCapturer,
    clipboard,
    dialog,
    Notification,
  } = context.electron;
  function interactive() {
    if (context.backgroundSmoke)
      throw Error("Unavailable during background verification.");
    if (closing())
      throw Error(
        nativeLocale(
          context,
          "O aplicativo está salvando as alterações.",
          "The application is saving your changes.",
          "La aplicación está guardando tus cambios.",
        ),
      );
  }
  function changed() {
    nativeEvent(context, "state", snapshot());
  }
  const gaze = createNativeGaze({
    window: () => context.overlay,
    area: (bounds) =>
      context.electron.screen.getDisplayMatching(bounds).workArea,
    clamp: layout.clamp,
    clock: () => performance.now(),
    align: layout.align,
    restored: () => {
      context.settings.bounds = layout.remember();
      saveNativeState(context);
    },
    changed,
  });
  const extension = context.extension?.(context, interactive) ?? null;
  function snapshot() {
    return {
      settings: context.settings,
      active: context.active,
      overlayVisible: Boolean(context.overlay?.isVisible()),
      failedShortcuts: context.failedShortcuts,
      platform: context.process.platform,
      distribution: nativeDistribution(context.process),
      arch: context.process.arch,
      version: app.getVersion(),
      deployment: context.deployment,
      remoteURL: context.remoteURL,
      vaultProtection: context.vaultProtection,
      gaze: { enabled: gaze.status().enabled },
      ...extension?.snapshot(),
    };
  }
  function register() {
    const result = registerNativeShortcuts({
      enabled: () => !context.backgroundSmoke,
      settings: () => context.settings,
      unregisterAll: () => globalShortcut.unregisterAll(),
      register: (key, callback) => globalShortcut.register(key, callback),
      toggle: layout.toggle,
      position: layout.position,
      clickthrough: () => {
        context.settings.clickthrough = !context.settings.clickthrough;
        layout.apply();
        saveNativeState(context);
      },
      command: (name) => nativeEvent(context, "shortcut", name),
    });
    context.failedShortcuts = result.failed;
    context.registeredShortcutCount = result.registered;
  }
  const preferences = createNativePreferences({
    settings: () => context.settings,
    commit: (value) => {
      context.settings = value;
    },
    save: (value) => saveNativePreferences(context.prefsFile, value),
    register,
    apply: layout.apply,
    tray: views.tray,
    interactive,
    assertLoginChange: () => {
      if (nativeDistribution(context.process).startup === "windows-settings")
        throw Error(nativeLocale(context, "A inicialização deste pacote é gerenciada pelo Windows.",
          "Startup for this package is managed by Windows.", "Windows administra el inicio de este paquete."));
    },
    loginSupported: () => app.isPackaged,
    login: (openAtLogin) =>
      app.setLoginItemSettings({
        openAtLogin,
        path:
          context.process.env.PORTABLE_EXECUTABLE_FILE ||
          context.process.execPath,
      }),
    ambient: layout.ambient,
    changed,
    state: snapshot,
  });
  const capture = createNativeCapture({
    interactive,
    sources: (options) => desktopCapturer.getSources(options),
    selected: () => context.sourceId,
    select: (id) => {
      context.sourceId = id;
    },
    clipboard: () => clipboard.readText(),
  });
  const systemAudio = createNativeSystemAudio(context, {
    interactive, contents: () => nativeWindows(context).map((window) => window.webContents),
  });
  const exportFile = createNativeExport({
    interactive,
    signal: context.abort.signal,
    choose: (options) => dialog.showSaveDialog(context.panel, options),
    write: async (filename, text) => {
      writeFileSync(filename, text, "utf8");
    },
  });
  const reminders = createNativeReminders({
    enabled: () => !context.backgroundSmoke && !closing(),
    clock: () => Date.now(),
    locale: () => context.settings.uiLocale,
    schedule: setTimeout,
    cancel: clearTimeout,
    show: (title, body) => {
      new Notification({ title, body }).show();
    },
  });
  return {
    gaze,
    extension,
    preferences,
    capture,
    systemAudio,
    exportFile,
    reminders,
    interactive,
    changed,
    snapshot,
    register,
    contents: () => nativeWindows(context).map((window) => window.webContents),
  };
}
export type NativeControllers = ReturnType<typeof createNativeControllers>;
