import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function createProgress(directory) {
  const filename = join(directory, "reporting-progress.json");
  const state = { stage: "initializing", event: "started", failedStage: null, completed: [] };
  const save = flag => writeFile(filename, JSON.stringify({ ...state, updated: new Date().toISOString() }, null, 2), { flag });
  await save("wx");
  return { state, async step(name, operation, timeout = 15000) {
    assert.match(name, /^[a-z][a-z-]{1,60}$/);
    assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 90000);
    state.stage = name; state.event = "started"; await save("w");
    let timer;
    try {
      const deadline = new Promise((_resolve, reject) => {
        timer = setTimeout(() => { const error = Error("Bounded native QA operation expired");
          error.name = "NativeOperationTimeout"; reject(error); }, timeout);
      });
      const value = await Promise.race([Promise.resolve().then(operation), deadline]);
      state.completed.push(name); state.event = "completed"; await save("w"); return value;
    } catch (error) {
      state.failedStage ??= name; state.event = "failed"; await save("w"); throw error;
    } finally { clearTimeout(timer); }
  } };
}
