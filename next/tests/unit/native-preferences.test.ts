import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultNativePreferences } from "../../packages/desktop/preference-defaults.ts";
import {
  nativePreferenceUpdate,
  restoreNativePreferences,
} from "../../packages/desktop/preference-validation.ts";
import {
  loadNativePreferences,
  saveNativePreferences,
} from "../../packages/desktop/preference-file.ts";
import { createNativePreferences } from "../../packages/desktop/native-preferences.ts";
import { registerNativeShortcuts } from "../../packages/desktop/native-shortcuts.ts";

test("native preferences preserve valid legacy settings and unrelated metadata while resetting clickthrough and repairing invalid fields", () => {
  const saved = restoreNativePreferences({
    opacity: 96,
    clickthrough: true,
    uiLocale: "bad",
    bounds: { x: -300, y: 2, width: 540, height: 200 },
    microphone: "synthetic-device",
    extraMetadata: { preserve: true },
    shortcuts: { toggle: "Alt+Space", toString: "bad" },
  });
  expect(saved).toMatchObject({
    opacity: 100,
    clickthrough: false,
    uiLocale: "pt-BR",
    microphone: "synthetic-device",
    extraMetadata: { preserve: true },
    bounds: { x: -300 },
    visualRevision: 3,
  });
  expect(saved.shortcuts.toggle).toBe("Alt+Space");
  expect(Object.hasOwn(saved.shortcuts, "toString")).toBe(false);
  expect(
    restoreNativePreferences({ opacity: 96, visualRevision: 3 }).opacity,
  ).toBe(96);
  expect(defaultNativePreferences().shortcuts).not.toBe(
    defaultNativePreferences().shortcuts,
  );
});

test("invalid preference patches are atomic and never mutate their supplied settings", () => {
  const settings = defaultNativePreferences();
  for (const patch of [
    { opacity: NaN },
    { opacity: 101 },
    { systemAudio: "true" },
    { chunkSeconds: 4 },
    { shortcuts: { toString: "Alt+X" } },
    { shortcuts: { toggle: 1 } },
    [],
  ])
    expect(() => nativePreferenceUpdate(settings, patch)).toThrow();
  expect(settings).toEqual(defaultNativePreferences());
  const updated = nativePreferenceUpdate(settings, {
    shortcuts: { ask: "Alt+X" },
    uiLocale: "en",
  });
  expect(updated.shortcuts.ask).toBe("Alt+X");
  expect(settings.shortcuts.ask).toBe("CommandOrControl+Enter");
});

test("listening opt-in and own-voice inclusion preserve legacy defaults and explicit choices", () => {
  const defaults = restoreNativePreferences({ systemAudio: true });
  expect(defaults.autoListen).toBe(false);
  expect(defaults.transcribeMicrophone).toBe(true);
  const updated = nativePreferenceUpdate(defaults, { autoListen: true, transcribeMicrophone: false });
  expect(restoreNativePreferences(JSON.parse(JSON.stringify(updated)))).toMatchObject({
    autoListen: true, transcribeMicrophone: false, systemAudio: true,
  });
  for (const value of [{ autoListen: "true" }, { transcribeMicrophone: 1 }])
    expect(() => nativePreferenceUpdate(defaults, value)).toThrow();
  expect(defaults.autoListen).toBe(false);
});

test("native preference persistence retains malformed originals, writes atomically and refuses oversize files without replacing them", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-native-preferences-")),
    file = join(root, "desktop.json");
  try {
    await writeFile(file, "synthetic malformed original");
    expect(loadNativePreferences(file)).toEqual(defaultNativePreferences());
    saveNativePreferences(file, {
      ...defaultNativePreferences(),
      uiLocale: "en",
      preserved: { value: 1 },
    });
    const names = await readdir(root),
      backup = names.find((name) => name.includes(".invalid-"));
    expect(backup).toBeDefined();
    expect(await readFile(join(root, backup!), "utf8")).toBe(
      "synthetic malformed original",
    );
    expect(loadNativePreferences(file)).toMatchObject({
      uiLocale: "en",
      preserved: { value: 1 },
    });
    expect(names.some((name) => name.includes(".pending-"))).toBe(false);
    const original = await readFile(file, "utf8");
    expect(() =>
      saveNativePreferences(file, {
        ...defaultNativePreferences(),
        oversized: "x".repeat(65536),
      }),
    ).toThrow("limit");
    expect(await readFile(file, "utf8")).toBe(original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native preference orchestration refuses login side effects in background and rolls back login when persistence fails", () => {
  let settings = defaultNativePreferences(),
    blocked = true,
    fail = false;
  const calls: string[] = [];
  const controller = createNativePreferences({
    settings: () => settings,
    commit: (value) => {
      settings = value;
      calls.push("commit");
    },
    save: () => {
      calls.push("save");
      if (fail) throw Error("synthetic disk failure");
    },
    register: () => calls.push("register"),
    apply: () => calls.push("apply"),
    tray: () => calls.push("tray"),
    interactive: () => {
      if (blocked) throw Error("background");
    },
    loginSupported: () => true,
    login: (enabled) => calls.push(`login:${enabled}`),
    ambient: () => calls.push("ambient"),
    changed: () => calls.push("changed"),
    state: () => settings,
  });
  expect(() => controller.update({ launchAtLogin: true })).toThrow(
    "background",
  );
  expect(calls).toEqual([]);
  blocked = false;
  fail = true;
  expect(() => controller.update({ launchAtLogin: true })).toThrow(
    "disk failure",
  );
  expect(calls).toEqual(["login:true", "save", "login:false"]);
  expect(settings.launchAtLogin).toBe(false);
  calls.length = 0;
  fail = false;
  controller.update({ ambientChat: true });
  expect(calls).toEqual([
    "save",
    "commit",
    "register",
    "apply",
    "tray",
    "ambient",
    "changed",
  ]);
  expect(() => controller.resetShortcut("toString")).toThrow("Atalho");
});

test("native shortcut registration tracks conflicts and isolates protected smoke runs while keeping callbacks mapped to their actions", () => {
  const callbacks = new Map<string, () => void>(),
    calls: string[] = [];
  let enabled = false;
  const ports = {
    enabled: () => enabled,
    settings: defaultNativePreferences,
    unregisterAll: () => calls.push("clear"),
    register: (key: string, callback: () => void) => {
      if (key === "CommandOrControl+Enter") return false;
      callbacks.set(key, callback);
      return true;
    },
    toggle: () => calls.push("toggle"),
    position: (name: string) => calls.push(name),
    clickthrough: () => calls.push("clickthrough"),
    command: (name: string) => calls.push(name),
  };
  expect(registerNativeShortcuts(ports)).toEqual({ failed: [], registered: 0 });
  expect(calls).toEqual([]);
  enabled = true;
  expect(registerNativeShortcuts(ports)).toEqual({
    failed: ["ask"],
    registered: 13,
  });
  callbacks.get("CommandOrControl+Shift+Space")!();
  callbacks.get("CommandOrControl+Shift+Home")!();
  callbacks.get("CommandOrControl+Shift+I")!();
  expect(calls).toEqual(["clear", "toggle", "camera", "clickthrough"]);
});
