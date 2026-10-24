import assert from "node:assert/strict";
import { clipboard } from "./copy.mjs";
import { assertDraft, copiedReport } from "./fixture.mjs";
export async function verifyDialog(application, page, selected, interception) {
  const open = () => page.locator(`[data-report-answer="${selected.responseId}"]`).click();
  await open();
  const include = page.locator("[data-report-include]");
  assert.equal(await include.isChecked(), false);
  assert.equal(await page.locator("[data-report-context]").inputValue(), "");
  await page.locator("[data-report-open]").click();
  await page.locator("[data-report-status]").filter({ hasText: "Add a reason" }).waitFor();
  assert.equal(await interception.evaluate(value => value.calls.length), 0);
  await page.locator("[data-report-cancel]").click();
  await page.locator("[data-report-form]").waitFor({ state: "detached" });
  assert.equal(await interception.evaluate(value => value.calls.length), 0);
  await open();
  await page.locator("[data-report-reason]").fill(selected.reason);
  await page.locator("[data-report-open]").click();
  await page.locator("[data-report-status]").filter({ hasText: "Copy the report" }).waitFor();
  // This first open is the deliberate final-adapter rejection; no OS request occurs.
  const firstBody = await page.locator("[data-report-preview]").inputValue();
  assert.ok(!firstBody.includes(selected.answer));
  let calls = await interception.evaluate(value => [...value.calls]);
  assert.equal(calls.length, 1); assertDraft(calls[0], firstBody);
  await page.locator("[data-report-include]").check();
  assert.equal(await page.locator("[data-report-context]").inputValue(), selected.answer);
  await page.locator("[data-report-context]").fill(selected.edited);
  await page.locator("[data-report-preview]").fill(selected.preview);
  await page.locator("[data-report-copy]").click();
  await page.locator("[data-report-status]").filter({ hasText: "Report copied" }).waitFor();
  assert.equal(await clipboard(application), copiedReport(selected.preview));
  calls = await interception.evaluate(value => [...value.calls]); assert.equal(calls.length, 1);
  const result = { cancel: true, initiallyUnchecked: true, excerpt: true, editedPreview: true,
    fallback: true, reportCopied: true, shellCalls: 1, draftArgumentValid: true,
    actualOsDispatchRequested: false, realDraftQualified: false, emailSent: false };
  await page.locator("[data-report-cancel]").click();
  await page.locator("[data-report-form]").waitFor({ state: "detached" });
  return result;
}
