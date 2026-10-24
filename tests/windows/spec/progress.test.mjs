import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProgress } from "../reporting/progress.mjs";
import { releaseShell } from "../reporting/interception.mjs";
test("native QA persists the exact bounded failing stage without exception or payload data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-reporting-progress-"));
  try {
    const progress = await createProgress(directory);
    assert.equal(await progress.step("ready", () => 42), 42);
    await assert.rejects(progress.step("waiting-for-fixture", () => new Promise(() => {}), 5), { name: "NativeOperationTimeout" });
    await assert.rejects(progress.step("adapter-cleanup", () => { throw Error("private payload must not be written"); }));
    const saved = JSON.parse(await readFile(join(directory, "reporting-progress.json")));
    assert.equal(saved.failedStage, "waiting-for-fixture"); assert.equal(saved.stage, "adapter-cleanup");
    assert.equal(saved.event, "failed"); assert.deepEqual(saved.completed, ["ready"]);
    assert.ok(!JSON.stringify(saved).includes("private payload"));
    await assert.rejects(progress.step("https://private.invalid", () => {}));
    await assert.rejects(progress.step("invalid-deadline", () => {}, 0));
    await assert.rejects(createProgress(directory), { code: "EEXIST" });
  } finally { await unlink(join(directory, "reporting-progress.json")); await rmdir(directory); }
});
test("a timed-out pending operation cannot reach the real shell adapter during failure cleanup", async () => {
  let dispatches = 0, rejections = 0, evaluateCalls = 0, completePending;
  const original = async () => { dispatches++; };
  const rejected = async () => { rejections++; throw Error("Synthetic rejected adapter"); };
  const shell = { openExternal: rejected }, interception = { original, rejected };
  const application = { evaluate: async (operation, value) => { evaluateCalls++; return operation({ shell }, value); } };
  const pending = new Promise(resolve => { completePending = resolve; })
    .then(() => shell.openExternal("mailto:support@orvunia.com")).catch(() => {});
  const directory = await mkdtemp(join(tmpdir(), "orvunia-pending-shell-"));
  const progress = await createProgress(directory);
  await assert.rejects(progress.step("report-rejected-draft", () => pending, 5), { name: "NativeOperationTimeout" });
  const step = (_name, operation) => operation();
  try {
  assert.equal(await releaseShell(application, interception, false, step), "rejection-retained-until-process-exit");
  completePending(); await pending;
  assert.equal(dispatches, 0); assert.equal(rejections, 1); assert.equal(evaluateCalls, 0);
  assert.equal(shell.openExternal, rejected);
  assert.equal(await releaseShell(application, interception, true, step), "restored-after-successful-settled-flow");
  assert.equal(shell.openExternal, original); assert.equal(evaluateCalls, 1); assert.equal(dispatches, 0);
  } finally { await unlink(join(directory, "reporting-progress.json")); await rmdir(directory); }
});
