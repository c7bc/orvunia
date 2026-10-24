import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export const code = "export const answer = 42;\n";
export const answer = "Synthetic native clipboard QA. No model was called.\n\n```typescript\n" + code + "```\n";
export const recipient = "support@orvunia.com";
export const subject = "Orvunia - AI content report";
export function fixture(identity) {
  assert.match(identity.run, /^\d+$/); assert.match(identity.attempt, /^\d+$/);
  const marker = `ORVUNIA-REPORT-QA-${identity.run}-${identity.attempt}`;
  return { sessionId: randomUUID(), responseId: randomUUID(), answer, code, marker,
    reason: `Synthetic report transport test ${marker}`,
    edited: `Edited synthetic excerpt ${marker}`,
    preview: `User-reviewed synthetic draft ${marker}` };
}
export function copiedReport(body) { return `To: ${recipient}\nSubject: ${subject}\n\n${body}`; }
export function assertDraft(url, body) {
  const value = new URL(url);
  assert.equal(value.protocol, "mailto:"); assert.equal(value.pathname, recipient);
  assert.deepEqual([...value.searchParams.keys()], ["subject", "body"]);
  assert.equal(value.searchParams.get("subject"), subject);
  assert.equal(value.searchParams.get("body"), body);
}
export function classify(observed) {
  return { nativeClipboardQualified: observed.textCopied === true && observed.codeCopied === true && observed.reportCopied === true,
    uiFallbackQualified: observed.fallback === true,
    shellArgumentBoundaryQualified: observed.shellCalls === 1 && observed.draftArgumentValid === true,
    shellBoundaryInstrumented: true, actualOsDispatchRequested: false, realDraftQualified: false,
    emailSent: false, windows11HardwareQualified: false, msixStoreQualified: false };
}
