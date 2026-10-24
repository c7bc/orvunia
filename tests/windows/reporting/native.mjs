import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { _electron } from "playwright";
import { loadContext, physical } from "../context.mjs";
import { isolatedEnvironment } from "../process.mjs";
import { coreCommit, desktopVersion, productName } from "../config.mjs";
import { distributionDigest } from "../runtime-audit.mjs";
import { verifyCopy } from "./copy.mjs";
import { verifyDialog } from "./dialog.mjs";
import { classify, copiedReport } from "./fixture.mjs";
import { installNetworkGuard } from "./network.mjs";
import { createProgress } from "./progress.mjs";
import { releaseShell } from "./interception.mjs";
import { createStartup } from "./startup.mjs";
const state = await loadContext(process.argv[2]);
const build = JSON.parse(await readFile(join(state.evidence, "build.json")));
assert.equal(build.coreCommit, coreCommit); assert.equal(build.version, desktopVersion);
const selected = JSON.parse(await readFile(join(state.root, "reporting-fixture.json")));
const unpacked = join(state.distribution, "win-unpacked");
const executable = await physical(join(unpacked, productName + ".exe"));
const runtime = await physical(join(unpacked, "resources/cadence-runtime"));
await physical(state.profile);
assert.equal(await distributionDigest(join(unpacked, "resources/app.asar")), build.archiveSha256);
const progress = await createProgress(state.evidence);
const step = (name, operation, timeout) => progress.step(name, operation, timeout);
let application, interception, permissions, network, child, exit, panel, startup;
const report = { status: "running", coreCommit, toolingCommit: state.identity.toolingCommit,
  desktopVersion, launchMode: "packaged-candidate", surface: "real-dashboard-session-detail",
  appAsarSha256: build.archiveSha256, physicalCapture: false, paidProviderCalls: 0,
  localBackendApiUsed: false, emailsSent: 0,
  shellBoundaryInstrumented: true, actualOsDispatchRequested: false, realDraftQualified: false,
  windows11HardwareQualified: false, msixStoreQualified: false, ownRendererCaptureOnly: true };
try {
  application = await step("launch", () => _electron.launch({ executablePath: executable,
    args: [`--candidate-runtime=${runtime}`, `--candidate-profile=${state.profile}`],
    cwd: state.root, env: isolatedEnvironment(process.env), timeout: 30000 }), 35000);
  child = application.process(); exit = once(child, "exit");
  for (const stream of ["stdout", "stderr"]) child[stream]?.on("data", bytes => startup?.observe(stream, bytes));
  startup = await step("startup-diagnostics", () => createStartup(application, state.evidence));
  const identity = await step("identity", () => application.evaluate(({ app }) => ({ packaged: app.isPackaged,
    version: app.getVersion(), profile: app.getPath("userData"), pid: process.pid })));
  assert.equal(identity.packaged, true); assert.equal(identity.version, desktopVersion);
  assert.equal(resolve(identity.profile), state.profile); report.packagedIdentityVerified = true;
  network = await step("network-guard", () => installNetworkGuard(application, selected.sessionId));
  interception = await step("shell-instrumentation", () => application.evaluateHandle(({ shell }) => {
    const original = shell.openExternal, calls = [];
    const rejected = async url => { calls.push(url); throw Error("Synthetic QA final-adapter rejection; no OS dispatch"); };
    shell.openExternal = rejected;
    if (shell.openExternal !== rejected) throw Error("Shell adapter is not instrumentable; refusing real dispatch");
    return { original, rejected, calls };
  }));
  await step("locate-panel", async () => {
  for (let attempt = 0; attempt < 600; attempt++) {
    panel = application.windows().find(page => page.url().includes("view=panel"));
    if (panel) break;
    if (attempt % 100 === 0) await startup.capture("panel-wait");
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(panel, "Real packaged dashboard required");
  }, 65000);
  panel.setDefaultTimeout(15000); panel.setDefaultNavigationTimeout(20000);
  await step("desktop-bridge", () => panel.waitForFunction(() => Boolean(window.cadence), undefined, { timeout: 10000 }));
  permissions = await step("deny-media", () => application.evaluateHandle(({ session }) => {
    const requests = [];
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => { requests.push(permission); callback(false); });
    return { requests };
  }));
  report.mediaPermissionDenyGuard = true;
  const snapshot = await step("configure-settings", () => panel.evaluate(async () =>
    window.cadence.settings({ uiLocale: "en", autoListen: false, autoAnswer: false, systemAudio: false,
      transcribeMicrophone: false, autoScreen: false, ambientChat: false })), 20000);
  for (const key of ["autoListen", "autoAnswer", "systemAudio", "transcribeMicrophone", "autoScreen", "ambientChat"])
    assert.equal(snapshot.settings[key], false);
  const onboarding = await step("complete-onboarding", () => panel.evaluate(async () => {
    const response = await fetch("/api/onboarding", { method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, completed: true, skipped: true, persona: "job", mode: "technical",
        goal: "Synthetic native reporting QA", experience: "3–5", output: "en", code: "TypeScript", tutorialComplete: false }) });
    return response.status;
  }), 20000);
  assert.equal(onboarding, 200); report.localBackendApiUsed = true;
  await step("reload-panel", () => panel.reload(), 25000);
  await step("open-fixture", () => panel.locator(`button.meeting-main[data-session="${selected.sessionId}"]`).click());
  await step("fixture-detail", () => panel.locator(`[data-session-detail="${selected.sessionId}"]`).waitFor());
  const text = await step("copy-answer", () => verifyCopy(application, panel, `button[data-action="copy:${selected.responseId}"]`, selected.answer));
  assert.equal(text.label, "Copied."); report.textCopied = true;
  const code = await step("copy-code", () => verifyCopy(application, panel, ".detail-chat-log .copy-code", selected.code));
  assert.equal(code.label, "Copied."); report.codeCopied = true;
  Object.assign(report, await verifyDialog(application, panel, selected, interception, step));
  const permissionRequests = await step("verify-permissions", () => permissions.evaluate(value => [...value.requests]));
  assert.deepEqual(permissionRequests, []); report.permissionRequests = 0;
  const blocked = await step("verify-network", () => network.evaluate(value => [...value.blocked]));
  assert.deepEqual(blocked, []); report.blockedRequests = 0;
  report.networkGuardCoverage = "after-attach-before-reporting-interaction-no-pre-attach-claim";
  Object.assign(report, classify(report));
  assert.equal(report.nativeClipboardQualified, true); assert.equal(report.uiFallbackQualified, true);
  assert.equal(report.shellArgumentBoundaryQualified, true);
  await step("success-screenshot", () => panel.screenshot({ path: join(state.evidence, "reporting-own-renderer.png"), timeout: 5000 }), 6000);
  report.status = "passed-hosted-windows-server-native-boundary-scope";
} catch (error) { report.status = "failed"; report.errorType = error.name;
  report.failedStage = progress.state.failedStage ?? progress.state.stage; throw error; }
finally {
  if (startup) {
    await step("startup-final-state", () => startup.capture("finally"), 5000).catch(() => {
      report.startupDiagnosticsUnconfirmed = true; report.status = "failed";
    });
    await startup.persist();
  }
  if (panel) await step("failure-diagnostics", async () => {
    report.pageState = await panel.evaluate(() => ({ ready: document.readyState, bridge: Boolean(window.cadence),
      fixtureButtons: document.querySelectorAll("button.meeting-main[data-session]").length,
      details: document.querySelectorAll("[data-session-detail]").length, reportForms: document.querySelectorAll("[data-report-form]").length }));
    await panel.screenshot({ path: join(state.evidence, "reporting-final-renderer.png"), timeout: 4000 });
  }, 5000).catch(() => { report.diagnosticsIncomplete = true; });
  if (application && interception) {
    report.adapterDisposition = await releaseShell(application, interception,
      report.status === "passed-hosted-windows-server-native-boundary-scope", step)
      .catch(() => { report.adapterRestoreUnconfirmed = true; return "restore-unconfirmed"; });
  }
  if (application) {
    await step("clear-owned-clipboard", () => application.evaluate(({ clipboard }, owned) => {
      if (owned.includes(clipboard.readText())) clipboard.clear();
    }, [selected.answer, selected.code, copiedReport(selected.preview)]), 5000).catch(() => { report.clipboardCleanupUnconfirmed = true; });
    await step("request-quit", () => application.evaluate(({ app }) => app.quit()), 5000).catch(() => {});
    if (child?.exitCode === null) {
      const deadline = setTimeout(() => child.kill(), 30000);
      try { await step("wait-owned-exit", () => exit, 35000); }
      catch { report.exitUnconfirmed = true; }
      finally { clearTimeout(deadline); }
    }
    report.cleanExit = child?.exitCode === 0;
    if (!report.cleanExit || report.exitUnconfirmed || report.adapterRestoreUnconfirmed || report.clipboardCleanupUnconfirmed) report.status = "failed";
  }
  if (startup) {
    await startup.persist();
    report.nativeStartupErrorCount = startup.state.nativeErrors.length;
    if (report.nativeStartupErrorCount) report.status = "failed";
  }
  report.lastStage = progress.state.stage;
  await writeFile(join(state.evidence, "reporting.json"), JSON.stringify(report, null, 2), { flag: "wx" });
}
assert.equal(report.status, "passed-hosted-windows-server-native-boundary-scope");
