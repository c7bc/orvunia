import { expect, test } from "bun:test";
import { nativeDistribution, readDistribution } from "../../packages/desktop/distribution.ts";
import { registerWindowsManagement } from "../../packages/desktop/management-native.ts";
import { openNativeUpdate } from "../../packages/desktop/application-update.ts";
import { permittedExternalURL } from "../../packages/desktop/external.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { NativeControllers } from "../../packages/desktop/application-controllers.ts";
import type { PlatformInvocation } from "../../packages/desktop/platform-types.ts";

test("distribution capabilities require real Windows package runtime and reject inconsistent snapshots", () => {
  const store = nativeDistribution({ platform: "win32", windowsStore: true });
  expect(readDistribution(store)).toEqual(store);
  const processes: { platform: string; windowsStore?: boolean }[] = [{ platform: "win32" }, { platform: "linux", windowsStore: true }, { platform: "win32", windowsStore: false }];
  for (const process of processes)
    expect(nativeDistribution(process)).toEqual({ channel: "standalone", updates: "release", startup: "native" });
  for (const value of [null, [], {}, { ...store, productId: "invented" }, { ...store, startup: "native" }, { channel: "store", startup: "windows-settings", updates: "windows-store" }])
    expect(() => readDistribution(value)).toThrow();
  expect(() => readDistribution(Object.assign(Object.create(store), { a: 1, b: 2, c: 3 }))).toThrow();
});

function fixture() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>(), opened: string[] = [];
  const frame = { url: "http://127.0.0.1:9915/desktop.html" };
  const sender = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  let closing = false, failOpen = false;
  const context = { origin: "http://127.0.0.1:9915", abort: new AbortController(),
    process: { platform: "win32", arch: "x64", windowsStore: true }, settings: { uiLocale: "en" },
    electron: { app: { getVersion: () => "4.10.3" }, ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => handlers.set(name, handler) },
      shell: { openExternal: async (url: string) => { if (failOpen) throw Error("OS handler unavailable"); opened.push(url); } } }
  } as unknown as NativeContext;
  const interactive = () => { if (closing) throw Error("Closing"); };
  registerWindowsManagement(context, { interactive, contents: () => [sender] } as unknown as NativeControllers);
  return { context, opened, sender, frame, interactive, invoke: handlers.get("cadence:openWindowsManagement")!,
    request: { sender, senderFrame: frame }, close: () => { closing = true; }, fail: () => { failOpen = true; } };
}

test("managed IPC opens only fixed startup/library URLs for a trusted live MSIX caller", async () => {
  const view = fixture();
  await view.invoke(view.request, "startup"); await view.invoke(view.request, "updates");
  expect(view.opened).toEqual(["ms-settings:startupapps", "ms-windows-store://downloadsandupdates"]);
  for (const action of [undefined, "https://evil.test", "ms-settings:privacy", { action: "startup" }])
    await expect(view.invoke(view.request, action)).rejects.toThrow();
  await expect(view.invoke({ sender: { ...view.sender }, senderFrame: view.frame }, "updates")).rejects.toThrow();
  await expect(view.invoke({ sender: view.sender, senderFrame: { ...view.frame } }, "updates")).rejects.toThrow();
  view.context.process.windowsStore = false;
  await expect(view.invoke(view.request, "startup")).rejects.toThrow();
  expect(view.opened).toHaveLength(2);
  expect(() => permittedExternalURL("ms-settings:startupapps", view.context.origin, null)).toThrow();
  expect(() => permittedExternalURL("ms-windows-store://downloadsandupdates", view.context.origin, null)).toThrow();
});

test("managed IPC honors lifecycle/cancellation and localizes OS launch failure", async () => {
  const closed = fixture(); closed.close();
  await expect(closed.invoke(closed.request, "startup")).rejects.toThrow("Closing"); expect(closed.opened).toEqual([]);
  const canceled = fixture(); canceled.context.abort.abort();
  await expect(canceled.invoke(canceled.request, "updates")).rejects.toHaveProperty("name", "AbortError");
  for (const [locale, text] of [["en", "Windows management"], ["es", "administración"], ["pt-BR", "gerenciamento"]] as const) {
    const failed = fixture(); failed.fail(); failed.context.settings.uiLocale = locale;
    await expect(failed.invoke(failed.request, "startup")).rejects.toThrow(text); expect(failed.opened).toEqual([]);
  }
});

test("Store runtime rejects standalone installers before fetching or opening any URL", async () => {
  const view = fixture(); let fetches = 0;
  const request = { sender: { session: { fetch: async () => { fetches++; throw Error("Must not fetch"); } } } };
  const fetcher = async () => { fetches++; throw Error("Must not fetch"); };
  await expect(openNativeUpdate(view.context, request as unknown as PlatformInvocation, "https://orvunia.com/setup.exe", view.interactive, () => {}, fetcher))
    .rejects.toThrow("Microsoft Store");
  expect(fetches).toBe(0); expect(view.opened).toEqual([]);
});
