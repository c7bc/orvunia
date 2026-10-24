import assert from "node:assert/strict";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { loadContext } from "./context.mjs";
const state = await loadContext(process.argv[2]);
async function optional(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
const build = await optional(join(state.evidence, "build.json")), lifecycle = await optional(join(state.evidence, "lifecycle.json"));
const phases = [], images = [];
for (const phase of ["baseline", "update", "quit", "reopen"]) {
  const report = await optional(join(state.root, "native-" + phase, "report.json")); if (!report) continue;
  const result = { phase, status: report.status, version: report.identity?.version, packaged: report.identity?.packaged,
    syntheticProfile: report.identity?.userData === state.profile, quitIpcRequested: report.quitIpcRequested === true,
    rendererErrors: report.errors?.length ?? null, previousSessionsRetained: report.lifecycle?.previousSessionsRetained?.length ?? null,
    persistedState: report.lifecycle?.persistedState, transcriptCount: report.lifecycle?.transcriptCount,
    responseCount: report.lifecycle?.responseCount, rendererDrainSaved: report.shutdown?.saved ?? null };
  phases.push(result); await writeFile(join(state.evidence, phase + ".json"), JSON.stringify(result, null, 2));
  for (const [filename, suffix] of [["desktop-painel.png", "panel"], ["desktop-overlay.png", "overlay"]]) {
    const source = join(state.root, "native-" + phase, filename); let bytes;
    try { bytes = await readFile(source); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    assert.ok(bytes.length < 10000000); const decoded = PNG.sync.read(bytes);
    assert.ok(decoded.width >= 200 && decoded.height >= 100 && decoded.width <= 10000 && decoded.height <= 10000);
    const colors = new Set();
    for (let offset = 0; offset < decoded.data.length; offset += Math.max(4, Math.floor(decoded.data.length / 8000 / 4) * 4))
      colors.add(decoded.data.subarray(offset, offset + 4).toString("hex"));
    assert.ok(colors.size > 8, "Native renderer screenshot is blank or lacks content");
    const destination = phase + "-" + suffix + ".png";
    await copyFile(source, join(state.evidence, destination));
    images.push({ path: destination, width: decoded.width, height: decoded.height, sampledColors: colors.size,
      sha256: createHash("sha256").update(bytes).digest("hex"), ownRendererOnly: true });
  }
}
const passed = lifecycle?.status === "passed" && phases.some(value => value.phase === "update" && value.status === "passed") &&
  images.some(value => value.path === "update-panel.png") && images.some(value => value.path === "update-overlay.png");
const summary = { status: passed ? "passed-hosted-windows-server-native-scope" : "failed-or-incomplete", environment: "GitHub hosted Windows Server2025 x64",
  toolingCommit: state.identity.toolingCommit, coreCommit: build?.coreCommit ?? null, desktopVersion: build?.version ?? null,
  setupSha256: build?.setupSha256 ?? null, archiveSha256: build?.archiveSha256 ?? null, bunSha256: build?.bunSha256 ?? null,
  lifecycle, phases, images, transcriptOrResponseQualityTested: false, physicalAudioTested: false, paidProviderCalls: 0,
  localBackendApiUsed: phases.some(value => value.persistedState === "ended") ? true : null,
  win11Qualified: false, msixStoreQualified: false, profileDatabaseOrCookiesUploaded: false,
  nativeLogsUploaded: false, ownRendererScreenshotsOnly: true, cleanupBoundary: "Owned install/runtime executables checked; tooling wrapper deadlines remain bounded and runner is disposable" };
await writeFile(join(state.evidence, "summary.json"), JSON.stringify(summary, null, 2));
if (!passed) throw Error("Native QA evidence incomplete; reports retained without profile, raw native logs or credentials");
