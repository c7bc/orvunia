import test from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { hostedContext, contained } from "../context.mjs";
import { isolatedEnvironment } from "../process.mjs";
import { desktopConfiguration } from "../configuration.mjs";
const environment = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "Windows",
  GITHUB_REPOSITORY: "c7bc/orvunia", GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: "a".repeat(40),
  RUNNER_TEMP: resolve("temporary-test-runner") };
test("native operations require exact repository and disposable Windows runner identity", () => {
  assert.equal(hostedContext(environment, "win32").run, "100");
  for (const key of Object.keys(environment)) {
    const changed = { ...environment }; delete changed[key]; assert.throws(() => hostedContext(changed, "win32"));
  }
  for (const [key, value] of [["RUNNER_ENVIRONMENT", "self-hosted"], ["GITHUB_REPOSITORY", "attacker/fork"],
    ["GITHUB_SHA", "HEAD"], ["GITHUB_RUN_ID", "../escape"], ["RUNNER_TEMP", "relative"]])
    assert.throws(() => hostedContext({ ...environment, [key]: value }, "win32"));
  assert.throws(() => hostedContext(environment, "linux"));
});
test("containment uses path boundaries rather than ambiguous prefixes", () => {
  const root = resolve("root"); assert.equal(contained(root, join(root, "child")), true);
  for (const value of [root, resolve(root, ".."), resolve(root, "../root-other"), resolve(root, "../../outside")])
    assert.equal(contained(root, value), false);
});
test("child environments preserve required runner identity and drop all authorization/provider inputs", () => {
  const selected = isolatedEnvironment({ ...environment, PATH: "tools", OPENAI_API_KEY: "not-a-key", GH_TOKEN: "not-a-token",
    GITHUB_TOKEN: "not-a-token", ACTIONS_RUNTIME_TOKEN: "not-a-token", DATABASE_URL: "not-a-database",
    NODE_OPTIONS: "--require unwanted", ELECTRON_RUN_AS_NODE: "1", CSC_LINK: "not-a-certificate", UNKNOWN: "value" });
  assert.equal(selected.PATH, "tools"); assert.equal(selected.GITHUB_RUN_ID, "100");
  for (const key of ["OPENAI_API_KEY", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "DATABASE_URL", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE", "CSC_LINK", "UNKNOWN"])
    assert.equal(Object.hasOwn(selected, key), false);
  assert.equal(selected.CSC_IDENTITY_AUTO_DISCOVERY, "false");
});
test("QA package keeps stable isolated identity and cannot auto-launch, sign, publish or delete profiles", () => {
  const value = desktopConfiguration("source", "runtime", "output", "electron");
  assert.equal(value.appId, "org.orvunia.qa.followup"); assert.equal(value.extraMetadata.version, "4.10.3");
  assert.equal(value.extraMetadata.dependencies, null); assert.equal(value.publish, null);
  assert.equal(value.forceCodeSigning, false); assert.equal(value.win.signExecutable, false);
  for (const key of ["runAfterFinish", "createDesktopShortcut", "createStartMenuShortcut", "deleteAppDataOnUninstall", "perMachine"])
    assert.equal(value.nsis[key], false);
  assert.ok(value.files.every(path => typeof path === "string"));
  assert.equal(value.extraResources[0].from, "runtime");
});
