import test from "node:test";
import assert from "node:assert/strict";
import { fixture, answer, code, copiedReport, assertDraft, classify, recipient, subject } from "../reporting/fixture.mjs";
import { verifyCopy } from "../reporting/copy.mjs";
import { installNetworkGuard } from "../reporting/network.mjs";

test("report fixture is explicitly synthetic and contains no provider, user or repository content", () => {
  const value = fixture({ run: "123", attempt: "1" });
  assert.match(value.sessionId, /^[0-9a-f-]{36}$/); assert.notEqual(value.sessionId, value.responseId);
  assert.equal(value.answer, answer); assert.equal(value.code, code);
  assert.ok(value.answer.includes("No model was called."));
  assert.ok(value.answer.includes("```typescript\n" + code));
  assert.deepEqual(Object.keys(value).sort(), ["sessionId", "responseId", "answer", "code", "marker", "reason", "edited", "preview"].sort());
  for (const run of ["../escape", "", "abc"]) assert.throws(() => fixture({ run, attempt: "1" }));
});

test("draft checker rejects recipient/subject/header overrides and preserves exact encoded body", () => {
  const body = "Synthetic café & bcc=not-a-header\nLine two";
  const good = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  assert.doesNotThrow(() => assertDraft(good, body));
  assert.equal(copiedReport(body), `To: ${recipient}\nSubject: ${subject}\n\n${body}`);
  for (const invalid of [good + "&bcc=other@example.test", good.replace(recipient, "other@example.test"),
    good.replace("mailto:", "https:"), good.replace(encodeURIComponent(subject), "Changed")])
    assert.throws(() => assertDraft(invalid, body));
  assert.throws(() => assertDraft(good, "Different content"));
});

test("instrumented shell or fallback alone cannot qualify clipboard or an actual OS mail draft", () => {
  const incomplete = classify({ fallback: true, shellCalls: 1, draftArgumentValid: true });
  assert.equal(incomplete.nativeClipboardQualified, false); assert.equal(incomplete.realDraftQualified, false);
  assert.equal(incomplete.actualOsDispatchRequested, false); assert.equal(incomplete.emailSent, false);
  const complete = classify({ textCopied: true, codeCopied: true, reportCopied: true,
    fallback: true, shellCalls: 1, draftArgumentValid: true });
  assert.equal(complete.nativeClipboardQualified, true); assert.equal(complete.uiFallbackQualified, true);
  assert.equal(complete.shellArgumentBoundaryQualified, true); assert.equal(complete.realDraftQualified, false);
  assert.equal(classify({ shellCalls: 2, draftArgumentValid: true }).shellArgumentBoundaryQualified, false);
  assert.equal(classify({ textCopied: "true", codeCopied: true, reportCopied: true }).nativeClipboardQualified, false);
});

test("native copy oracle requires actual clipboard match and copied feedback, not only a resolved click", async () => {
  let copied = "wrong", clicked = false;
  const page = { locator: () => ({ click: async () => { clicked = true; },
    evaluate: async () => ({ state: "copied", label: "Copied.", busy: "false" }) }),
    waitForFunction: async () => {} };
  const application = { evaluate: async () => copied };
  await assert.rejects(() => verifyCopy(application, page, "button", "expected")); assert.equal(clicked, true);
  copied = "expected";
  assert.equal((await verifyCopy(application, page, "button", "expected")).state, "copied");
});

test("reporting network guard blocks provider operations and remote requests rather than pretending they passed", async () => {
  let listener; const exits = [];
  const id = "12345678-1234-1234-1234-123456789abc";
  const application = { evaluateHandle: async (fn, value) => fn({ app: { exit: code => exits.push(code) }, session: { defaultSession: {
    webRequest: { onBeforeRequest: value => { listener = value; } } } } }, value) };
  const state = await installNetworkGuard(application, id);
  const check = (method, url) => { let result; listener({ method, url }, value => { result = value; }); return result.cancel; };
  assert.equal(check("GET", "http://127.0.0.1:9915/desktop.html?view=panel"), false);
  assert.equal(check("PUT", "http://127.0.0.1:9915/api/onboarding"), false);
  assert.equal(check("GET", "ws://127.0.0.1:9915/events"), false);
  assert.equal(check("PATCH", `http://127.0.0.1:9915/api/sessions/${id}/notes`), false);
  for (const [method, url] of [["POST", "http://127.0.0.1:9915/api/ask"],
    ["POST", "http://127.0.0.1:9915/api/transcribe"], ["GET", "https://api.example.test/provider"],
    ["GET", "http://user:password@127.0.0.1:9915/private"], ["GET", "file:///private.txt"],
    ["PATCH", "http://127.0.0.1:9915/api/sessions/other/notes"]])
    assert.equal(check(method, url), true);
  assert.equal(state.blocked.length, 6);
  assert.deepEqual(exits, [2, 2, 2, 2, 2, 2]);
  assert.ok(!JSON.stringify(state.blocked).includes("password"));
  assert.throws(() => installNetworkGuard(application, "../other"));
});
