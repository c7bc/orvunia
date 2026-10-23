import { expect, test } from "bun:test";
import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeControllers } from "../../packages/desktop/application-controllers.ts";
import { defaultNativePreferences } from "../../packages/desktop/preference-defaults.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { NativeLayout } from "../../packages/desktop/application-layout.ts";
import type { NativeViews } from "../../packages/desktop/application-views.ts";

test("real controller snapshot exposes MSIX management and rejects fake startup toggle without persistence/registry", async () => {
  const root = await mkdtemp(join(tmpdir(), "orvunia-msix-preferences-")); let loginWrites = 0;
  const settings = { ...defaultNativePreferences(), uiLocale: "en" as const };
  const context = { prefsFile: join(root, "desktop.json"), desktopDirectory: root, abort: new AbortController(),
    process: { platform: "win32", arch: "x64", windowsStore: true, env: {} }, settings,
    panel: null, overlay: null, control: null, active: null, failedShortcuts: [],
    electron: { app: { isPackaged: true, getVersion: () => "4.10.3", setLoginItemSettings: () => { loginWrites++; } },
      globalShortcut: {}, desktopCapturer: {}, clipboard: {}, dialog: {}, Notification: class {} }
  } as unknown as NativeContext;
  try {
    const controllers = createNativeControllers(context, {} as NativeLayout, {} as NativeViews, () => false);
    expect(controllers.snapshot().distribution).toEqual({ channel: "msix", updates: "windows-store", startup: "windows-settings" });
    expect(() => controllers.preferences.update({ launchAtLogin: true })).toThrow("managed by Windows");
    expect(context.settings).toBe(settings); expect(context.settings.launchAtLogin).toBe(false); expect(loginWrites).toBe(0);
    await expect(access(context.prefsFile)).rejects.toThrow();
  } finally { context.abort.abort(); await rm(root, { recursive: true, force: true }); }
});
