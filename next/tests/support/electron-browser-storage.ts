import { createRequire } from "node:module";
import { join } from "node:path";
import assert from "node:assert/strict";
import { preserveDesktopBrowserStorage } from "../../packages/desktop/browser-storage.ts";
import { nativeBrowserStorage } from "../../packages/desktop/browser-storage-native.ts";
import type {
  BrowserStorageSession,
  BrowserStorageWindow,
} from "../../packages/desktop/browser-storage-types.ts";

type Session = BrowserStorageSession & { flushStorageData(): void };
type Window = BrowserStorageWindow & {
  isVisible(): boolean;
  isFocused(): boolean;
};
const electron = createRequire(import.meta.url)("electron") as {
  app: {
    on(name: string, listener: () => void): void;
    setPath(name: string, value: string): void;
    disableHardwareAcceleration(): void;
    whenReady(): Promise<void>;
    exit(code: number): void;
  };
  BrowserWindow: { new (options: object): Window; getAllWindows(): Window[] };
  session: { defaultSession: Session };
};
const directory = process.env.CADENCE_TEST_DATA!;
electron.app.setPath("userData", join(directory, "profile"));
electron.app.disableHardwareAcceleration();
electron.app.on("window-all-closed", () => {});
process.on("uncaughtException", () => electron.app.exit(1));

async function run() {
  const session = electron.session.defaultSession;
  let created = 0;
  const createWindow = () => {
    created++;
    const window = new electron.BrowserWindow({
      show: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    assert.equal(window.isVisible(), false);
    assert.equal(window.isFocused(), false);
    return window;
  };
  const seed = async (
    origin: string,
    entries: readonly (readonly [string, string | null])[],
  ) => {
    assert.equal(await session.protocol.isProtocolHandled("http"), false);
    session.protocol.handle(
      "http",
      () =>
        new Response("<!doctype html><title>Synthetic storage</title>", {
          headers: {
            "content-type": "text/html",
            "content-security-policy": "default-src 'none'",
          },
        }),
    );
    const window = createWindow();
    try {
      await window.loadURL(origin + "/synthetic-fixture");
      await window.webContents.executeJavaScript(
        `(()=>{for(const[key,value]of ${JSON.stringify(entries)}){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}return true;})()`,
      );
    } finally {
      window.destroy();
      session.protocol.unhandle("http");
    }
  };
  const open = () =>
    nativeBrowserStorage({
      session,
      createWindow,
      signal: new AbortController().signal,
      assertQuiescent() {
        assert.equal(electron.BrowserWindow.getAllWindows().length, 0);
      },
    });
  const preserve = (origin: string) =>
    preserveDesktopBrowserStorage({
      profile: join(directory, "profile"),
      origin,
      signal: new AbortController().signal,
      open,
    });
  const agenda = "cadence-agenda:" + "a".repeat(24);
  const draft = `cadence-followup:${agenda}:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`;
  if (process.env.CADENCE_TEST_PHASE === "prepare") {
    await seed("http://127.0.0.1:8790", [
      [agenda, "synthetic original agenda"],
      [draft, "synthetic draft"],
      ["other-app-key", "foreign original"],
    ]);
    await seed("http://127.0.0.1:8792", [["cadence-ui-locale", "pt-BR"]]);
    await seed("http://127.0.0.1:8809", [
      ["other-app-key", "foreign destination"],
    ]);
    assert.deepEqual(await preserve("http://127.0.0.1:8809"), {
      entries: 3,
      moved: true,
    });
    const inspect = await open();
    try {
      assert.deepEqual(
        new Map(
          (await inspect.read("http://127.0.0.1:8809")) as [string, string][],
        ).get("other-app-key"),
        "foreign destination",
      );
      assert.equal(
        new Map(
          (await inspect.read("http://127.0.0.1:8790")) as [string, string][],
        ).get(agenda),
        "synthetic original agenda",
      );
    } finally {
      inspect.close();
    }
    await seed("http://127.0.0.1:8809", [
      [agenda, "synthetic latest agenda"],
      [draft, null],
    ]);
    assert.deepEqual(await preserve("http://127.0.0.1:8795"), {
      entries: 2,
      moved: true,
    });
  } else {
    assert.deepEqual(await preserve("http://127.0.0.1:8790"), {
      entries: 2,
      moved: true,
    });
    const inspect = await open();
    try {
      const entries = new Map(
        (await inspect.read("http://127.0.0.1:8790")) as [string, string][],
      );
      assert.equal(entries.get(agenda), "synthetic latest agenda");
      assert.equal(entries.has(draft), false);
      assert.equal(entries.get("other-app-key"), "foreign original");
      assert.equal(entries.get("cadence-ui-locale"), "pt-BR");
    } finally {
      inspect.close();
    }
  }
  assert.equal(await session.protocol.isProtocolHandled("http"), false);
  assert.equal(electron.BrowserWindow.getAllWindows().length, 0);
  session.flushStorageData();
  console.log(
    JSON.stringify({
      event: "electron_browser_storage_passed",
      phase: process.env.CADENCE_TEST_PHASE,
      hiddenWindows: created,
    }),
  );
}
electron.app
  .whenReady()
  .then(run)
  .then(() => electron.app.exit(0))
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Browser storage verification failed",
    );
    electron.app.exit(1);
  });
