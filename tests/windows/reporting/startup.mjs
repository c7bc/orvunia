import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const systemCodes = ["ENOENT", "ENOTDIR", "EACCES", "EPERM", "EBUSY", "EADDRINUSE",
  "SQLITE_BUSY", "SQLITE_ERROR", "ERR_MODULE_NOT_FOUND"];
export async function createStartup(application, directory) {
  const filename = join(directory, "reporting-startup.json");
  const errorFile = join(directory, "reporting-native-errors.jsonl");
  const state = { dialogAdapter: "recorder-until-process-exit-any-call-fails", snapshots: [], streams: {} }, tails = {};
  const codes = new Set(["provider-configuration-unreadable", "backend-runtime-repair", "backend-recovery-exhausted",
    "browser-storage-verification", "browser-storage-not-quiescent", "browser-storage-protocol-handled",
    "browser-storage-closed", "browser-storage-session-mismatch", "browser-storage-navigation",
    "browser-storage-navigation-changed", "unclassified-native-error"]);
  async function persist(flag) {
    const text = await readFile(errorFile, "utf8");
    assert.ok(text.length < 16000);
    const values = text.split("\n").filter(Boolean).map(line => JSON.parse(line));
    assert.ok(values.length <= 8);
    for (const value of values) assert.ok(value && codes.has(value.code) &&
      Object.keys(value).sort().join() === "backend,code,codes,configuration,storage" &&
      Array.isArray(value.codes) && value.codes.length <= systemCodes.length &&
      new Set(value.codes).size === value.codes.length && value.codes.every(code => systemCodes.includes(code)) &&
      [value.backend, value.configuration, value.storage].every(field => typeof field === "boolean"),
      "Native error evidence must contain only the finite sanitized schema");
    state.nativeErrors = values;
    await writeFile(filename, JSON.stringify(state, null, 2), { flag });
  }
  await writeFile(errorFile, "", { flag: "wx" });
  await persist("wx");
  const handle = await application.evaluateHandle(({ dialog, BrowserWindow, app }, { errorFile, systemCodes }) => {
    const errors = [], known = new Map([
      ["Desktop provider configuration cannot be read", "provider-configuration-unreadable"],
      ["Backend requires runtime repair", "backend-runtime-repair"],
      ["Backend failed after bounded recovery", "backend-recovery-exhausted"],
      ["Desktop browser storage verification failed", "browser-storage-verification"],
      ["Browser storage migration requires a quiescent profile", "browser-storage-not-quiescent"],
      ["Browser storage migration requires an unmodified HTTP protocol", "browser-storage-protocol-handled"],
      ["Browser storage migration is closed", "browser-storage-closed"],
      ["Browser storage migration window must use its owning session", "browser-storage-session-mismatch"],
      ["Unexpected browser storage navigation", "browser-storage-navigation"],
      ["Browser storage navigation changed", "browser-storage-navigation-changed"],
    ]);
    let errorCalls = 0;
    const recorder = (_title, message) => {
      errorCalls++;
      if (errors.length < 8) {
        const value = { code: known.get(message) ?? "unclassified-native-error",
          codes: systemCodes.filter(code => new RegExp("\\b" + code + "\\b").test(message)),
        backend: /backend|runtime/i.test(message), storage: /storage|profile|origin/i.test(message),
          configuration: /configuration|environment/i.test(message) };
        errors.push(value);
        process.getBuiltinModule("node:fs").appendFileSync(errorFile, JSON.stringify(value) + "\n");
      }
    };
    dialog.showErrorBox = recorder;
    if (dialog.showErrorBox !== recorder) throw Error("Startup error recorder unavailable");
    return { snapshot() {
      return { ready: app.isReady(), dialogRecorderIntact: dialog.showErrorBox === recorder,
        nativeErrorCalls: errorCalls, errors: [...errors], windows: BrowserWindow.getAllWindows().map(window => {
          try {
            const contents = window.webContents, raw = contents.getURL();
            let role = raw === "about:blank" || !raw ? "pending" : "other";
            try {
              const url = new URL(raw), view = url.searchParams.get("view");
              if (url.protocol === "http:" && url.hostname === "127.0.0.1" && !url.username && !url.password) {
                if (url.pathname === "/desktop.html" && ["panel", "overlay", "control"].includes(view)) role = view;
                else if (url.pathname.startsWith("/__cadence_storage_")) role = "storage-migration";
              }
            } catch {}
            return { role, loading: contents.isLoading(), visible: window.isVisible() };
          } catch { return { role: "unavailable" }; }
        }).slice(0, 16) };
    } };
  }, { errorFile, systemCodes });
  return { state, persist: () => persist("w"), observe(stream, bytes) {
    assert.ok(["stdout", "stderr"].includes(stream));
    const text = (tails[stream] ?? "") + bytes.toString(), previous = state.streams[stream] ?? { bytes: 0, codes: [] };
    tails[stream] = text.slice(-64);
    state.streams[stream] = { bytes: Math.min(previous.bytes + bytes.length, 10000000),
      codes: systemCodes.filter(code => previous.codes.includes(code) || new RegExp("\\b" + code + "\\b").test(text)),
      backend: previous.backend || /backend|runtime/i.test(text),
      storage: previous.storage || /storage|profile/i.test(text),
      gpu: previous.gpu || /gpu|angle|directcomposition/i.test(text),
      error: previous.error || /error|failed|fatal/i.test(text) };
  }, async capture(phase) {
    assert.ok(["panel-wait", "finally"].includes(phase));
    const snapshot = await handle.evaluate(value => value.snapshot());
    state.snapshots.push({ phase, ...snapshot });
    state.snapshots = state.snapshots.slice(-16);
    await persist("w");
    assert.equal(snapshot.dialogRecorderIntact, true);
    assert.equal(snapshot.nativeErrorCalls, 0, "Native startup error recorded; run cannot pass");
    return snapshot;
  } };
}
