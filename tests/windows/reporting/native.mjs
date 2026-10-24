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
const state = await loadContext(process.argv[2]);
const build = JSON.parse(await readFile(join(state.evidence, "build.json")));
assert.equal(build.coreCommit, coreCommit); assert.equal(build.version, desktopVersion);
const selected = JSON.parse(await readFile(join(state.root, "reporting-fixture.json")));
const unpacked = join(state.distribution, "win-unpacked");
const executable = await physical(join(unpacked, productName + ".exe"));
const runtime = await physical(join(unpacked, "resources/cadence-runtime"));
await physical(state.profile);
assert.equal(await distributionDigest(join(unpacked, "resources/app.asar")), build.archiveSha256);
let application, interception, permissions, network, child, exit, panel;
const report = { status: "running", coreCommit, toolingCommit: state.identity.toolingCommit,
  desktopVersion, launchMode: "packaged-candidate", surface: "real-dashboard-session-detail",
  appAsarSha256: build.archiveSha256, physicalCapture: false, paidProviderCalls: 0,
  localBackendApiUsed: false, emailsSent: 0,
  shellBoundaryInstrumented: true, actualOsDispatchRequested: false, realDraftQualified: false,
  windows11HardwareQualified: false, msixStoreQualified: false, ownRendererCaptureOnly: true };
try {
  application = await _electron.launch({ executablePath: executable,
    args: [`--candidate-runtime=${runtime}`, `--candidate-profile=${state.profile}`],
    cwd: state.root, env: isolatedEnvironment(process.env), timeout: 30000 });
  child = application.process(); exit = once(child, "exit");
  const identity = await application.evaluate(({ app }) => ({ packaged: app.isPackaged,
    version: app.getVersion(), profile: app.getPath("userData"), pid: process.pid }));
  assert.equal(identity.packaged, true); assert.equal(identity.version, desktopVersion);
  assert.equal(resolve(identity.profile), state.profile); report.packagedIdentityVerified = true;
  network = await installNetworkGuard(application, selected.sessionId);
  interception = await application.evaluateHandle(({ shell }) => {
    const original = shell.openExternal, calls = [];
    const rejected = async url => { calls.push(url); throw Error("Synthetic QA final-adapter rejection; no OS dispatch"); };
    shell.openExternal = rejected;
    if (shell.openExternal !== rejected) throw Error("Shell adapter is not instrumentable; refusing real dispatch");
    return { original, rejected, calls };
  });
  for (let attempt = 0; attempt < 600; attempt++) {
    panel = application.windows().find(page => page.url().includes("view=panel"));
    if (panel) break; await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(panel, "Real packaged dashboard required");
  await panel.waitForFunction(() => Boolean(window.cadence));
  permissions = await application.evaluateHandle(({ session }) => {
    const requests = [];
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => { requests.push(permission); callback(false); });
    return { requests };
  });
  report.mediaPermissionDenyGuard = true;
  const configured = await panel.evaluate(async () => {
    const snapshot = await window.cadence.settings({ uiLocale: "en", autoListen: false,
      autoAnswer: false, systemAudio: false, transcribeMicrophone: false, autoScreen: false, ambientChat: false });
    const response = await fetch("/api/onboarding", { method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, completed: true, skipped: true, persona: "job", mode: "technical",
        goal: "Synthetic native reporting QA", experience: "3–5", output: "en", code: "TypeScript", tutorialComplete: false }) });
    return { settings: snapshot.settings, onboarding: response.status };
  });
  assert.equal(configured.onboarding, 200);
  report.localBackendApiUsed = true;
  for (const key of ["autoListen", "autoAnswer", "systemAudio", "transcribeMicrophone", "autoScreen", "ambientChat"])
    assert.equal(configured.settings[key], false);
  await panel.reload();
  await panel.locator(`button.meeting-main[data-session="${selected.sessionId}"]`).click();
  await panel.locator(`[data-session-detail="${selected.sessionId}"]`).waitFor();
  const text = await verifyCopy(application, panel, `button[data-action="copy:${selected.responseId}"]`, selected.answer);
  assert.equal(text.label, "Copied."); report.textCopied = true;
  const code = await verifyCopy(application, panel, ".detail-chat-log .copy-code", selected.code);
  assert.equal(code.label, "Copied."); report.codeCopied = true;
  Object.assign(report, await verifyDialog(application, panel, selected, interception));
  const permissionRequests = await permissions.evaluate(value => [...value.requests]);
  assert.deepEqual(permissionRequests, []); report.permissionRequests = 0;
  const blocked = await network.evaluate(value => [...value.blocked]);
  assert.deepEqual(blocked, []); report.blockedRequests = 0;
  report.networkGuardCoverage = "after-attach-before-reporting-interaction-no-pre-attach-claim";
  Object.assign(report, classify(report));
  assert.equal(report.nativeClipboardQualified, true); assert.equal(report.uiFallbackQualified, true);
  assert.equal(report.shellArgumentBoundaryQualified, true);
  await panel.screenshot({ path: join(state.evidence, "reporting-own-renderer.png") });
  report.status = "passed-hosted-windows-server-native-boundary-scope";
} catch (error) { report.status = "failed"; report.errorType = error.name; throw error; }
finally {
  if (application && interception) {
    await application.evaluate(({ shell }, value) => {
      if (shell.openExternal !== value.rejected) throw Error("Unexpected shell adapter mutation");
      shell.openExternal = value.original;
    }, interception).catch(() => { report.adapterRestoreUnconfirmed = true; });
  }
  if (application) {
    await application.evaluate(({ clipboard }, owned) => {
      if (owned.includes(clipboard.readText())) clipboard.clear();
    }, [selected.answer, selected.code, copiedReport(selected.preview)]).catch(() => {});
    await application.evaluate(({ app }) => app.quit()).catch(() => {});
    if (child?.exitCode === null) {
      const deadline = setTimeout(() => child.kill(), 30000);
      try { await exit; } finally { clearTimeout(deadline); }
    }
    report.cleanExit = child?.exitCode === 0;
    if (!report.cleanExit || report.adapterRestoreUnconfirmed) report.status = "failed";
  }
  await writeFile(join(state.evidence, "reporting.json"), JSON.stringify(report, null, 2), { flag: "wx" });
}
assert.equal(report.status, "passed-hosted-windows-server-native-boundary-scope");
