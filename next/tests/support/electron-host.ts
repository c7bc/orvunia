import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import type { NativeSecretStorage } from "../../packages/desktop/native-vault.ts";
import type {
  NativeContents,
  NativeSession,
} from "../../packages/desktop/session.ts";
import { verifyDesktopClient, verifyDesktopPanel } from "./electron-client.ts";
import { verifyDesktopModes } from "./electron-modes.ts";
import { verifyNativeDocuments } from "./electron-documents.ts";
interface Contents extends NativeContents {
  executeJavaScript(script: string): Promise<unknown>;
}
interface Window {
  webContents: Contents;
  loadURL(url: string): Promise<void>;
  destroy(): void;
}
type TestSession = NativeSession & {
  fetch(url: string, options?: RequestInit): Promise<Response>;
};
type ElectronRuntime = {
  app: {
    setPath(name: string, path: string): void;
    whenReady(): Promise<void>;
    disableHardwareAcceleration(): void;
    exit(code: number): void;
  };
  BrowserWindow: new (options: object) => Window;
  session: { fromPartition(name: string): TestSession };
  safeStorage: NativeSecretStorage;
};
const electron = createRequire(import.meta.url)("electron") as ElectronRuntime;
const directory = process.env.CADENCE_TEST_DATA!;
const root = process.env.CADENCE_TEST_BACKEND_ROOT!;
const { desktopBackend, nativeSecretVault, loadRuntimeRelease } = createRequire(
  import.meta.url,
)(
  join(root, "../desktop/runtime.cjs"),
) as typeof import("../../packages/desktop/index.ts");
electron.app.setPath("userData", join(directory, "electron"));
electron.app.disableHardwareAcceleration();
let host: ReturnType<typeof desktopBackend> | null = null;
let window: Window | null = null;
async function run() {
  const packaged = process.env.CADENCE_TEST_RUNTIME_PACKAGE
    ? await loadRuntimeRelease(
        process.env.CADENCE_TEST_RUNTIME_PACKAGE,
        new AbortController().signal,
      )
    : null;
  const executable = packaged?.executable ?? process.env.CADENCE_TEST_BUN!;
  const checksum =
    packaged?.release.executableSha256 ??
    createHash("sha256")
      .update(await readFile(executable))
      .digest("hex");
  const vault = nativeSecretVault(electron.safeStorage, process.platform);
  assert.ok(
    vault,
    "Native encryption must be available for this platform test",
  );
  const partition = `cadence-synthetic-${crypto.randomUUID()}`;
  const session = electron.session.fromPartition(partition);
  const port = Number(process.env.PORT);
  const origin = `http://127.0.0.1:${port}`;
  host = desktopBackend({
    session,
    contents: () => (window ? [window.webContents] : []),
    onState() {},
    launch: {
      executable,
      checksum,
      entrypoint: packaged?.entrypoint ?? join(root, "apps/desktop/server.ts"),
      directory: packaged?.directory ?? root,
      port,
      vault,
      environment: {
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
        CADENCE_DEPLOYMENT: "local",
        CADENCE_LOCAL_TOKEN: process.env.CADENCE_LOCAL_TOKEN!,
        CADENCE_LOCAL_WORKSPACE: process.env.CADENCE_LOCAL_WORKSPACE!,
        CADENCE_SQLITE_PATH: join(directory, "cadence-next.sqlite"),
        CADENCE_CLIENT_DIRECTORY:
          packaged?.clientDirectory ?? join(directory, "client"),
        CADENCE_PUBLIC_URL: origin,
        PORT: String(port),
      },
    },
  });
  assert.deepEqual(await host.start(), { origin });
  await verifyNativeDocuments({ fetch }, root, origin);
  await verifyNativeDocuments(
    electron.session.fromPartition(`cadence-documents-${crypto.randomUUID()}`),
    root,
    origin,
  );
  window = new electron.BrowserWindow({
    show: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await window.loadURL(origin + "/desktop.html?view=panel");
  await verifyDesktopClient(window.webContents);
  await window.loadURL(origin + "/desktop.html?view=panel");
  await verifyDesktopPanel(window.webContents);
  await verifyDesktopModes(window.webContents, () =>
    window!.loadURL(origin + "/desktop.html?view=panel"),
  );
  const request = (method = "GET", body?: object) =>
    window!.webContents.executeJavaScript(`
    fetch('/api/providers', {method:${JSON.stringify(method)},headers:{'content-type':'application/json'},${body ? `body:JSON.stringify(${JSON.stringify(body)}),` : ""}})
      .then(async response=>({status:response.status,text:await response.text()}))
  `) as Promise<{ status: number; text: string }>;
  const synthetic = "synthetic-electron-safe-storage-key";
  const update = await request("PUT", {
    response: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "synthetic",
      maxTokens: 1000,
      vision: true,
      apiKey: synthetic,
    },
    transcription: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "synthetic",
      realtimeModel: "",
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.text.includes(synthetic), false);
  assert.equal(
    (await readFile(join(directory, "providers.v2.json"), "utf8")).includes(
      synthetic,
    ),
    false,
  );
  assert.equal((await session.fetch(origin + "/api/providers")).status, 401);
  await host.stop();
  assert.equal(host.status(), "stopped");
  await host.start();
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.text).protection, "os");
  assert.equal(JSON.parse(result.text).response.keyConfigured, true);
  assert.equal(result.text.includes(synthetic), false);
  const persisted = (await window.webContents.executeJavaScript(
    `Promise.all([fetch('/api/bootstrap').then(r=>r.json()),fetch('/api/onboarding').then(r=>r.json())]).then(([boot,onboarding])=>({sessions:boot.sessions.map(s=>({state:s.state,transcripts:s.transcripts.length})),completed:onboarding.completed}))`,
  )) as {
    sessions: { state: string; transcripts: number }[];
    completed: boolean;
  };
  assert.equal(persisted.completed, true);
  assert.equal(persisted.sessions.length, 2);
  assert.equal(
    persisted.sessions.every(
      (value) => value.state === "ended" && value.transcripts === 1,
    ),
    true,
  );
  console.log(
    JSON.stringify({
      event: "electron_backend_passed",
      encryption: "native",
      hidden: true,
    }),
  );
}
electron.app
  .whenReady()
  .then(run)
  .then(async () => {
    await host?.stop();
    window?.destroy();
    electron.app.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(
      "Isolated Electron backend verification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    await host?.stop().catch(() => {});
    window?.destroy();
    electron.app.exit(1);
  });
