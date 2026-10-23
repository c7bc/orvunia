import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrapNativeApplication } from "../../packages/desktop/application-bootstrap.ts";
import type { NativeOptions } from "../../packages/desktop/application-types.ts";
import type { NativePlatform } from "../../packages/desktop/platform-types.ts";
import { createWindowMotion } from "../../packages/desktop/window-motion.ts";

test("a fresh isolated candidate is marked before Electron initializes its profile directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "orvunia-candidate-bootstrap-"));
  const appData = join(root, "appdata"), profile = join(root, "candidate"), runtime = join(root, "runtime");
  await mkdir(appData); await mkdir(runtime);
  let locks = 0;
  const app = {
    isPackaged: false, setName() {}, setAppUserModelId() {},
    setPath(_name: string, path: string) {
      expect(path).toBe(profile);
      expect(existsSync(join(profile, "candidate-profile.json"))).toBe(true);
      writeFileSync(join(profile, "Preferences"), "synthetic Chromium initialization");
    },
    getPath: (name: string) => name === "appData" ? appData : join(root, "temp"),
    requestSingleInstanceLock() { locks++; return true; },
    quit() {},
  };
  const options: NativeOptions = {
    electron: { app } as unknown as NativePlatform, root,
    desktopDirectory: join(root, "desktop"), resourcesPath: join(root, "resources"), createMotion: createWindowMotion,
    process: { argv: [`--candidate-runtime=${runtime}`, `--candidate-profile=${profile}`], env: {},
      platform: "win32", arch: "x64", execPath: join(root, "Orvunia.exe"), versions: {}, on() {} }, metadata: {},
  };
  try {
    const first = bootstrapNativeApplication(options)!;
    expect(first.launch?.kind).toBe("candidate"); expect(locks).toBe(1);
    expect(JSON.parse(await readFile(join(profile, "candidate-profile.json"), "utf8")).token).toBe(first.identity!.token);
    const reopened = bootstrapNativeApplication(options)!;
    expect(reopened.identity).toEqual(first.identity); expect(locks).toBe(2);
    expect(existsSync(join(appData, "Cadence"))).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
