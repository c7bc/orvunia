import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import type { SecretVault } from "../providers/domain.ts";
import type { Email } from "../notifications/domain.ts";
const email = z
  .object({
    to: z.email().max(254),
    subject: z.string().max(200),
    text: z.string().max(30000),
    html: z.string().max(500000),
  })
  .strict();
export type FollowupCipher = {
  seal(value: Email): Promise<string>;
  open(value: string): Promise<Email>;
};
export function followupCipher(vault: SecretVault): FollowupCipher {
  return {
    seal: (value) => vault.seal(JSON.stringify(email.parse(value))),
    open: async (value) => email.parse(JSON.parse(await vault.open(value))),
  };
}
export function managedFollowupVault(secret: string): SecretVault {
  if (secret.length < 32) throw Error("Invalid follow-up encryption secret");
  const context = Buffer.from("cadence.followup/v1"),
    key = createHash("sha256").update(context).update(secret).digest();
  return {
    async seal(value) {
      const nonce = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(context);
      const payload = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return [
        "v1",
        nonce.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        payload.toString("base64url"),
      ].join(".");
    },
    async open(value) {
      if (value.length > 1_000_000) throw Error("Invalid follow-up envelope");
      const [version, nonce, tag, payload, extra] = value.split(".");
      if (
        version !== "v1" ||
        !nonce ||
        !tag ||
        !payload ||
        extra ||
        Buffer.from(nonce, "base64url").length !== 12 ||
        Buffer.from(tag, "base64url").length !== 16
      )
        throw Error("Invalid follow-up envelope");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(nonce, "base64url"),
      );
      decipher.setAAD(context);
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(payload, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
