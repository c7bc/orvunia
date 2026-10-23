import { expect, test } from "bun:test";
import { followupEmail } from "../../packages/followups/template.ts";
import {
  followupCipher,
  managedFollowupVault,
} from "../../packages/followups/cipher.ts";
test("every maximum-length reviewed draft stays bounded and round-trips its original plain text", async () => {
  const cipher = followupCipher(
    managedFollowupVault("synthetic-followup-envelope-secret-for-testing"),
  );
  for (const body of [
    "\n".repeat(30000),
    "😀".repeat(15000),
    "<>&\"'".repeat(6000),
  ]) {
    const email = await followupEmail(
      {
        recipient: "recipient@example.test",
        subject: "Synthetic",
        body,
        revision: 1,
        updatedAt: new Date().toISOString(),
      },
      "en",
    );
    expect(email.text).toBe(body);
    expect(email.html.length).toBeLessThan(500000);
    expect(email.html).toContain('lang="en"');
    expect(await cipher.open(await cipher.seal(email))).toEqual(email);
  }
});
