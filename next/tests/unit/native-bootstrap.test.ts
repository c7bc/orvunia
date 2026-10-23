import { expect, test } from "bun:test";
import { mkdtemp, mkdir, access, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrapNativeApplication } from "../../packages/desktop/application-bootstrap.ts";
import type { NativeOptions } from "../../packages/desktop/application-types.ts";
import type { NativePlatform } from "../../packages/desktop/platform-types.ts";
import { createWindowMotion } from "../../packages/desktop/window-motion.ts";

for (const windowsStore of [undefined, true])
test(`native bootstrap preserves profile/lock and ${windowsStore ? "inherits package AUMID" : "retains standalone AUMID"}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-native-bootstrap-"));
  const appData = join(root, "appdata"),
    profile = join(appData, "Cadence");
  await mkdir(appData);
  let owned = false,
    prepared = false,
    visibleName = "",
    applicationIdentifier = "";
  const calls: string[] = [];
  const app = {
    isPackaged: true,
    setName: (value: string) => {
      visibleName = value;
    },
    setAppUserModelId: (value: string) => {
      applicationIdentifier = value;
    },
    setPath: (_name: string, value: string) => {
      calls.push("profile:" + value);
    },
    getPath: (name: string) =>
      name === "appData" ? appData : join(root, "temp"),
    requestSingleInstanceLock() {
      calls.push("lock");
      expect(existsSync(join(profile, "runtime-profile.json"))).toBe(prepared);
      return owned;
    },
    quit() {
      calls.push("quit");
    },
  };
  const electron = new Proxy(
    { app },
    {
      get(target, key) {
        if (key !== "app") throw Error("Unexpected bootstrap platform access");
        return target.app;
      },
    },
  ) as unknown as NativePlatform;
  const options: NativeOptions = {
    electron,
    root,
    desktopDirectory: join(root, "desktop"),
    resourcesPath: join(root, "resources"),
    createMotion: createWindowMotion,
    process: {
      ...(windowsStore === true ? { windowsStore } : {}),
      argv: [],
      env: {},
      platform: "win32",
      arch: "x64",
      execPath: join(root, "Cadence.exe"),
      versions: {},
      on() {},
    },
    metadata: {
      cadenceDesktop: {
        format: "cadence-desktop-release/1",
        runtime: "bun",
        channel: "integrated",
      },
    },
  };
  try {
    expect(bootstrapNativeApplication(options)).toBeNull();
    expect(visibleName).toBe("Orvunia");
    expect(applicationIdentifier).toBe(windowsStore === true ? "" : "local.cadence.studio");
    expect(calls).toEqual(["profile:" + profile, "lock", "quit"]);
    await expect(access(profile)).rejects.toThrow();
    calls.length = 0;
    owned = true;
    const context = bootstrapNativeApplication(options)!;
    expect(calls).toEqual(["profile:" + profile, "lock"]);
    expect(context.launch?.kind).toBe("integrated");
    expect(context.profile).toBe(profile);
    expect(
      JSON.parse(await readFile(join(profile, "runtime-profile.json"), "utf8"))
        .token,
    ).toBe(context.identity!.token);
    expect(context.settings.uiLocale).toBe("pt-BR");
    prepared = true;
    const preferences = JSON.stringify({ ...context.settings, uiLocale: "es" });
    await writeFile(context.prefsFile, preferences);
    const identityBytes = await readFile(join(profile, "runtime-profile.json"));
    calls.length = 0;
    const reopened = bootstrapNativeApplication(options)!;
    expect(visibleName).toBe("Orvunia");
    expect(applicationIdentifier).toBe(windowsStore === true ? "" : "local.cadence.studio");
    expect(calls).toEqual(["profile:" + profile, "lock"]);
    expect(reopened.profile).toBe(profile);
    expect(reopened.settings.uiLocale).toBe("es");
    expect(reopened.identity).toEqual(context.identity);
    expect(await readFile(reopened.prefsFile, "utf8")).toBe(preferences);
    expect(await readFile(join(profile, "runtime-profile.json"))).toEqual(
      identityBytes,
    );
    expect(existsSync(join(appData, "Orvunia"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
