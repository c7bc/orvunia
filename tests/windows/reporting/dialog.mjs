import assert from "node:assert/strict";
import { clipboard } from "./copy.mjs";
import { assertDraft, copiedReport } from "./fixture.mjs";
export async function verifyDialog(application, page, selected, interception, step) {
  const action = (name, operation) => step("report-" + name, operation);
  const open = () => action("open", () => page.locator('[data-report-answer="' + selected.responseId + '"]').click());
  const calls = () => interception.evaluate(value => [...value.calls]);
  await open();
  await action("initial-defaults", async () => {
    assert.equal(await page.locator("[data-report-include]").isChecked(), false);
    assert.equal(await page.locator("[data-report-context]").inputValue(), "");
    await page.locator("[data-report-open]").click();
    await page.locator("[data-report-status]").filter({ hasText: "Add a reason" }).waitFor();
    assert.equal((await calls()).length, 0);
  });
  await action("cancel", async () => {
    await page.locator("[data-report-cancel]").click();
    await page.locator("[data-report-form]").waitFor({ state: "detached" });
    assert.equal((await calls()).length, 0);
  });
  await open();
  await action("rejected-draft", async () => {
    await page.locator("[data-report-reason]").fill(selected.reason);
    await page.locator("[data-report-open]").click();
    await page.locator("[data-report-status]").filter({ hasText: "Copy the report" }).waitFor();
    const firstBody = await page.locator("[data-report-preview]").inputValue();
    assert.ok(!firstBody.includes(selected.answer));
    const recorded = await calls(); assert.equal(recorded.length, 1); assertDraft(recorded[0], firstBody);
  });
  await action("edit-preview", async () => {
    await page.locator("[data-report-include]").check();
    assert.equal(await page.locator("[data-report-context]").inputValue(), selected.answer);
    await page.locator("[data-report-context]").fill(selected.edited);
    await page.locator("[data-report-preview]").fill(selected.preview);
  });
  await action("copy-fallback", async () => {
    await page.locator("[data-report-copy]").click();
    await page.locator("[data-report-status]").filter({ hasText: "Report copied" }).waitFor();
    assert.equal(await clipboard(application), copiedReport(selected.preview));
    assert.equal((await calls()).length, 1);
  });
  const result = { cancel: true, initiallyUnchecked: true, excerpt: true, editedPreview: true,
    fallback: true, reportCopied: true, shellCalls: 1, draftArgumentValid: true,
    actualOsDispatchRequested: false, realDraftQualified: false, emailSent: false };
  await action("close", async () => {
    await page.locator("[data-report-cancel]").click();
    await page.locator("[data-report-form]").waitFor({ state: "detached" });
  });
  return result;
}
