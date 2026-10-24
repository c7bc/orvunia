import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { loadContext, physical } from "./context.mjs";
import { baseline, desktopVersion, productName } from "./config.mjs";
const [statePath, phase] = process.argv.slice(2), state = await loadContext(statePath);
assert.ok(["baseline", "update", "quit", "reopen"].includes(phase));
const version = phase === "baseline" ? baseline.version : desktopVersion;
const executable = await physical(join(phase === "reopen" ? join(state.distribution, "win-unpacked") : state.installation, productName + ".exe"));
const profile = state.profile, output = join(state.root, "native-" + phase), quitByIpc = phase === "quit";
await mkdir(profile, { recursive: true }); await mkdir(output, { recursive: true });
await writeFile(join(profile, "isolated-qa-profile.json"), JSON.stringify({ format: "cadence-isolated-profile/1" }));
await writeFile(join(profile, "desktop.json"), JSON.stringify({ autoListen: false, autoAnswer: false,
  transcribeMicrophone: false, systemAudio: false, autoScreen: false, ambientChat: false, uiLocale: "en" }));
const environment = Object.fromEntries(["PATH", "PATHEXT", "SystemRoot", "SystemDrive", "windir", "ComSpec",
  "USERPROFILE", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP"].flatMap(name => process.env[name] ? [[name, process.env[name]]] : []));
const { _electron } = await import("playwright");
const report = { kind: "exact-packaged-public-native-lifecycle", executable, profile, physicalDevices: false,
  paidProviders: false, computerUse: false, errors: [], started: new Date().toISOString() };
let application, child, logs = "", exit;
let previous = [];
try { previous = JSON.parse(await readFile(join(profile, "lifecycle-history.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
try {
  application = await _electron.launch({ executablePath: executable, args: ["--smoke-background"], cwd: output,
    env: { ...environment, CADENCE_TEST_INTEGRATED_PROFILE: profile, CADENCE_TEST_OUTPUT_DIR: output,
      CADENCE_TEST_SHUTDOWN_FIXTURE: quitByIpc ? "0" : "1" }, timeout: 30000 });
  child = application.process(); exit = once(child, "exit");
  child.stdout?.on("data", data => logs += data); child.stderr?.on("data", data => logs += data);
  report.identity = await application.evaluate(({ app }) => ({ packaged: app.isPackaged,
    version: app.getVersion(), userData: app.getPath("userData"), application: app.getAppPath(), pid: process.pid }));
  assert.equal(report.identity.packaged, true); assert.equal(report.identity.version, version); assert.equal(resolve(report.identity.userData), profile);
  let panel;
  for (let attempt = 0; attempt < 2400; attempt++) {
    panel = application.windows().find(page => page.url().includes("view=panel"));
    if (panel) break; await new Promise(done => setTimeout(done, 25));
  }
  assert.ok(panel, "Packaged panel must exist");
  panel.on("pageerror", error => report.errors.push(error.message));
  await panel.waitForFunction(() => Boolean(window.cadence), { timeout: 10000 });
  report.lifecycle = await panel.evaluate(async previous => {
    const request = async (path, method = "GET", body) => {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-Cadence-Request": "1" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw Error(`QA request ${path}: ${response.status}`); return response.json();
    };
    await window.cadence.settings({ autoListen: false, autoAnswer: false, systemAudio: false,
      transcribeMicrophone: false, autoScreen: false, ambientChat: false });
    const health = await request("/api/health");
    const restored = [];
    for (const id of previous) {
      const saved = await request("/api/sessions/" + id);
      if (saved.state !== "ended" || saved.title !== "Synthetic packaged lifecycle") throw Error("Prior synthetic history changed");
      const notes = await request("/api/sessions/" + id + "/notes");
      if (notes.text !== "Synthetic native lifecycle note") throw Error("Prior synthetic notes changed");
      restored.push(id);
    }
    const session = await request("/api/sessions", "POST", { title: "Synthetic packaged lifecycle", mode: "technical" });
    const notes = await request("/api/sessions/" + session.id + "/notes");
    await request("/api/sessions/" + session.id + "/notes", "PATCH", { text: "Synthetic native lifecycle note", revision: notes.revision });
    const begun = await window.cadence.begin({ id: session.id, mode: "technical" });
    const ended = await window.cadence.end();
    await request("/api/sessions/" + session.id, "PATCH", { state: "ended" });
    const saved = await request("/api/sessions/" + session.id);
    return { id: session.id, begun: begun.active?.id === session.id, ended: ended.active === null,
      persistedState: saved.state, transcriptCount: saved.transcripts.length, responseCount: saved.responses.length,
      deployment: health.deployment, previousSessionsRetained: restored };
  }, previous);
  assert.equal(report.lifecycle.begun, true); assert.equal(report.lifecycle.ended, true);
  assert.equal(report.lifecycle.persistedState, "ended"); assert.equal(report.lifecycle.deployment, "local");
  assert.equal(report.lifecycle.transcriptCount, 0); assert.equal(report.lifecycle.responseCount, 0);
  await writeFile(join(profile, "lifecycle-history.json"), JSON.stringify([...previous, report.lifecycle.id]));
  if (quitByIpc) await panel.evaluate(() => { void window.cadence.quit(); });
  const timer = setTimeout(() => child.kill(), 60000);
  try { await exit; } finally { clearTimeout(timer); }
  assert.equal(child.exitCode, 0, "Packaged app did not exit cleanly; raw logs remain only in the ephemeral runner");
  report.quitIpcRequested = quitByIpc;
  if (!quitByIpc) {
  report.smoke = JSON.parse(await readFile(join(output, "desktop-smoke.json"), "utf8"));
  report.shutdown = JSON.parse(await readFile(join(output, "desktop-shutdown.json"), "utf8"));
  assert.equal(report.smoke.runtimeKind, "integrated"); assert.equal(report.smoke.keyConfigured, false);
  for (const key of ["visibleWindows", "focusedWindows", "focusableWindows", "registeredShortcuts"])
    assert.equal(report.smoke.background[key], 0);
  assert.equal(report.smoke.background.trayCreated, false); assert.equal(report.smoke.background.desktopCaptureSkipped, true);
  assert.equal(report.shutdown.pending, 0); assert.equal(report.shutdown.saved, report.shutdown.requested);
  assert.ok(report.shutdown.saved >= 1); assert.deepEqual(report.errors, []); report.status = "passed";
  }
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = error.stack; throw error; }
finally {
  if (child?.exitCode === null) await application.evaluate(({ app }) => app.exit(1)).catch(() => {});
  await writeFile(join(output, "runner.log"), logs);
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, version: report.identity.version, sessionId: report.lifecycle.id }));


