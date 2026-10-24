import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { verifyCopy } from "./copy.mjs";
import { coreCommit, desktopVersion } from "../config.mjs";
const variants = [
  { locale: "en", title: "Report answer", copied: "Copied.", reason: "Synthetic screenshot draft. No personal data.",
    captions: ["Technical interview mode: review an answer and copy its code.", "Choose the content to include in an editable support report."] },
  { locale: "pt-BR", title: "Reportar resposta", copied: "Copiado.", reason: "Rascunho sintético de captura. Sem dados pessoais.",
    captions: ["Modo de entrevista técnica: revise uma resposta e copie o código.", "Escolha o conteúdo incluído em um relato editável ao suporte."] },
  { locale: "es", title: "Reportar respuesta", copied: "Copiado.", reason: "Borrador sintético de captura. Sin datos personales.",
    captions: ["Modo de entrevista técnica: revisa una respuesta y copia su código.", "Elige el contenido incluido en un reporte editable al soporte."] },
];
export function imageProof(bytes, metrics) {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(bytes.length <= 50 * 1024 * 1024);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.ok(width > 0 && height > 0 && width <= 8192 && height <= 8192);
  assert.equal(width, Math.round(metrics.width * metrics.scale));
  assert.equal(height, Math.round(metrics.height * metrics.scale));
  assert.ok(width >= 1366 && height >= 768, "Native renderer image is below the Store desktop minimum; never resize it");
  const decoded = PNG.sync.read(bytes), colors = new Set();
  for (let index = 0; index < decoded.data.length; index += Math.max(4, Math.floor(decoded.data.length / 8000 / 4) * 4))
    colors.add(decoded.data.subarray(index, index + 4).toString("hex"));
  assert.ok(colors.size > 8, "Own renderer image is blank or lacks content");
  return { bytes: bytes.length, width, height, sha256: createHash("sha256").update(bytes).digest("hex"),
    sampledColors: colors.size, storeSizeEligible: width >= 1366 && height >= 768, resized: false };
}
export async function captureLocales(application, page, directory, selected, interception, step, provenance) {
  assert.match(provenance.toolingCommit, /^[a-f0-9]{40}$/); assert.match(provenance.archiveSha256, /^[a-f0-9]{64}$/);
  const requested = { width: 1920, height: 1080 };
  const nativeSize = await step("screenshot-native-size", () => application.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows().find(value => value.webContents.getURL().includes("view=panel"));
    if (!window) throw Error("Existing own panel required");
    window.setMaximumSize(3840, 2160);
    window.setContentSize(size.width, size.height);
    return window.getContentSize();
  }, requested));
  assert.ok(nativeSize[0] >= 1366 && nativeSize[1] >= 768, "Own native content size is below the Store minimum");
  await step("screenshot-viewport", () => page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1],
    nativeSize, { timeout: 10000 }));
  const records = [], beforeCalls = await step("screenshot-shell-count", () => interception.evaluate(value => value.calls.length));
  async function capture(variant, scene, caption) {
    assert.ok(caption.length <= 200);
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scale: devicePixelRatio,
      locale: document.documentElement.lang }));
    assert.equal(metrics.locale, variant.locale);
    const path = `draft-local-${variant.locale}-${scene}.png`;
    await page.screenshot({ path: join(directory, path), timeout: 5000 });
    records.push({ path, locale: variant.locale, scene, caption, metrics,
      ...imageProof(await readFile(join(directory, path)), metrics) });
  }
  for (const variant of variants) {
    const key = variant.locale.toLowerCase();
    await step("screenshot-language-" + key, async () => {
      const snapshot = await page.evaluate(locale => window.cadence.settings({ uiLocale: locale }), variant.locale);
      assert.equal(snapshot.settings.uiLocale, variant.locale);
      await page.reload();
      await page.waitForFunction(locale => document.documentElement.lang === locale, variant.locale, { timeout: 10000 });
      await page.locator(`button.meeting-main[data-session="${selected.sessionId}"]`).click();
      await page.locator(`[data-session-detail="${selected.sessionId}"]`).waitFor();
    }, 30000);
    await step("screenshot-detail-" + key, async () => {
      const copied = await verifyCopy(application, page, ".detail-chat-log .copy-code", selected.code);
      assert.equal(copied.label, variant.copied);
      await capture(variant, "technical", variant.captions[0]);
    });
    await step("screenshot-report-" + key, async () => {
      await page.locator(`[data-report-answer="${selected.responseId}"]`).click();
      assert.equal(await page.locator(".report-dialog .modal-head h2").textContent(), variant.title);
      assert.equal(await page.locator("[data-report-include]").isChecked(), false);
      await page.locator("[data-report-reason]").fill(variant.reason);
      await page.locator("[data-report-include]").check();
      assert.equal(await page.locator("[data-report-context]").inputValue(), selected.answer);
      await capture(variant, "report", variant.captions[1]);
      await page.locator("[data-report-cancel]").click();
      await page.locator("[data-report-form]").waitFor({ state: "detached" });
      assert.equal(await interception.evaluate(value => value.calls.length), beforeCalls);
    });
  }
  await step("screenshot-restore-language", async () => {
    await page.evaluate(() => window.cadence.settings({ uiLocale: "en" }));
    await page.waitForFunction(() => document.documentElement.lang === "en", undefined, { timeout: 10000 });
  });
  const manifest = { kind: "qa-draft-not-registered-msix", storeSubmissionReady: false,
    identityReserved: false, nativeWindowsStoreQualified: false, physicalDesktopCaptured: false,
    coreCommit, desktopVersion, toolingCommit: provenance.toolingCommit, archiveSha256: provenance.archiveSha256,
    source: "https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images",
    requirements: { minimumWidth: 1366, minimumHeight: 768, maximumBytes: 50 * 1024 * 1024, maximumCaptionCharacters: 200 },
    requestedViewport: requested, nativeContentSize: nativeSize, resizedImages: false,
    allStoreSizeEligible: records.every(value => value.storeSizeEligible),
    method: "Actual Electron panel renderer screenshot; UI locale selected through real native settings; synthetic saved answer only",
    additionalShellCalls: 0, providerCalls: 0, emailsSent: 0, records };
  await writeFile(join(directory, "screenshot-drafts.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
  return { locales: variants.map(value => value.locale), screenshots: records.length,
    storeSizeEligible: manifest.allStoreSizeEligible, storeSubmissionReady: false };
}
