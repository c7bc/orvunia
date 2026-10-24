import assert from "node:assert/strict";
export async function clipboard(application) {
  return application.evaluate(({ clipboard }) => clipboard.readText());
}
export async function verifyCopy(application, page, selector, expected) {
  await page.locator(selector).click();
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.copyState === "copied", selector);
  assert.equal(await clipboard(application), expected);
  const state = await page.locator(selector).evaluate(button => ({ state: button.dataset.copyState,
    label: button.getAttribute("aria-label"), busy: button.getAttribute("aria-busy") }));
  assert.equal(state.state, "copied"); assert.equal(state.busy, "false");
  assert.ok(state.label?.length); return state;
}
