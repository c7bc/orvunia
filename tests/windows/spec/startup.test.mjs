import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStartup } from "../reporting/startup.mjs";
test("startup recorder preserves finite failure evidence without displaying dialogs or leaking URLs/messages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-startup-diagnostic-"));
  let realDialogs = 0;
  const dialog = { showErrorBox: () => { realDialogs++; } };
  const window = url => ({ webContents: { getURL: () => url, isLoading: () => false }, isVisible: () => false });
  const electron = { dialog, app: { isReady: () => true }, BrowserWindow: { getAllWindows: () => [
    window("about:blank"), window("http://127.0.0.1:8790/desktop.html?view=panel"),
    window("http://127.0.0.1:8790/__cadence_storage_synthetic"),
    window("https://user:synthetic-private@invalid.test/path"),
  ] } };
  const application = { evaluateHandle: async (operation, argument) => {
    const value = operation(electron, argument); return { evaluate: callback => callback(value) };
  } };
  try {
    const startup = await createStartup(application, directory);
    const initial = await startup.capture("panel-wait");
    assert.deepEqual(initial.windows.map(value => value.role), ["pending", "panel", "storage-migration", "other"]);
    startup.observe("stderr", Buffer.from("Synthetic-private stdout bytes runtime failed ENOENT ERR_MOD"));
    startup.observe("stderr", Buffer.from("ULE_NOT_FOUND"));
    dialog.showErrorBox("Ignored title", "Backend requires runtime repair");
    dialog.showErrorBox("Ignored title", "Synthetic-private configuration text ENOTDIR SQLITE_ERROR");
    await assert.rejects(startup.capture("finally"), { name: "AssertionError" });
    const saved = JSON.parse(await readFile(join(directory, "reporting-startup.json")));
    const last = saved.snapshots.at(-1);
    assert.equal(last.nativeErrorCalls, 2); assert.equal(last.dialogRecorderIntact, true);
    assert.equal(last.errors[0].code, "backend-runtime-repair");
    assert.equal(last.errors[1].code, "unclassified-native-error");
    assert.deepEqual(last.errors[1].codes, ["ENOTDIR", "SQLITE_ERROR"]);
    assert.equal(saved.streams.stderr.backend, true); assert.equal(saved.streams.stderr.error, true);
    assert.deepEqual(saved.streams.stderr.codes, ["ENOENT", "ERR_MODULE_NOT_FOUND"]);
    assert.equal(realDialogs, 0);
    for (const secret of ["Synthetic-private", "invalid.test", "Ignored title", "8790", "__cadence_storage_synthetic"])
      assert.ok(!JSON.stringify(saved).includes(secret));
    assert.throws(() => startup.observe("arbitrary", Buffer.from("ignored")));
    await assert.rejects(startup.capture("arbitrary"));
    assert.equal(saved.nativeErrors.length, 2);
    const errors = await readFile(join(directory, "reporting-native-errors.jsonl"), "utf8");
    assert.ok(errors.includes("backend-runtime-repair")); assert.ok(!errors.includes("Synthetic-private"));
  } finally {
    await unlink(join(directory, "reporting-startup.json"));
    await unlink(join(directory, "reporting-native-errors.jsonl")); await rmdir(directory);
  }
});
