import assert from "node:assert/strict";
import { lstat, realpath, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep, join } from "node:path";
import { repository } from "./config.mjs";
export function contained(root, path) {
  const child = relative(root, path);
  return child !== "" && !isAbsolute(child) && child !== ".." && !child.startsWith(".." + sep);
}
export function hostedContext(environment, platform = process.platform) {
  assert.equal(platform, "win32", "Windows runner required");
  assert.equal(environment.GITHUB_ACTIONS, "true");
  assert.equal(environment.RUNNER_ENVIRONMENT, "github-hosted");
  assert.equal(environment.RUNNER_OS, "Windows"); assert.equal(environment.GITHUB_REPOSITORY, repository);
  assert.match(environment.GITHUB_RUN_ID ?? "", /^\d+$/);
  assert.match(environment.GITHUB_RUN_ATTEMPT ?? "", /^\d+$/);
  assert.match(environment.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  assert.ok(isAbsolute(environment.RUNNER_TEMP ?? ""));
  return { run: environment.GITHUB_RUN_ID, attempt: environment.GITHUB_RUN_ATTEMPT, toolingCommit: environment.GITHUB_SHA };
}
export async function physical(path) {
  assert.ok(isAbsolute(path)); assert.equal(await realpath(path), resolve(path));
  assert.ok(!(await lstat(path)).isSymbolicLink()); return resolve(path);
}
export async function loadContext(path) {
  const identity = hostedContext(process.env), state = JSON.parse(await readFile(await physical(path), "utf8"));
  assert.equal(state.format, "orvunia-native-ci/1"); assert.deepEqual(state.identity, identity);
  assert.equal(state.root, resolve(process.env.RUNNER_TEMP, `orvunia-${identity.run}-${identity.attempt}-${identity.toolingCommit.slice(0, 8)}`));
  assert.equal(resolve(path), join(state.root, "state.json")); await physical(state.root);
  for (const key of ["profile", "installation", "evidence", "distribution", "runtime", "baseline"])
    assert.equal(state[key], join(state.root, key));
  return state;
}
export async function prepareContext() {
  const identity = hostedContext(process.env), root = resolve(process.env.RUNNER_TEMP,
    `orvunia-${identity.run}-${identity.attempt}-${identity.toolingCommit.slice(0, 8)}`);
  await physical(process.env.RUNNER_TEMP); await mkdir(root);
  const state = { format: "orvunia-native-ci/1", identity, root };
  for (const key of ["profile", "installation", "evidence", "distribution", "runtime", "baseline"]) state[key] = join(root, key);
  await mkdir(state.evidence); await mkdir(state.baseline);
  const path = join(root, "state.json"); await writeFile(path, JSON.stringify(state), { flag: "wx" });
  await writeFile(process.env.GITHUB_OUTPUT, `state=${path}\nevidence=${state.evidence}\n`, { flag: "a" });
  return state;
}
