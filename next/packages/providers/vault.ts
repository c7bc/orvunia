import { readPrivateFile } from "./private-file.ts";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, open, link, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import type { SecretVault } from "./domain.ts";

export function fileVault(
  filename: string,
  purpose = "cadence.providers/v1",
  maximumEnvelopeLength = 40_000,
): SecretVault {
  async function key(create: boolean) {
    try {
      const existing = await readPrivateFile(filename, 32);
      if (existing.length !== 32) throw Error("Invalid local encryption key");
      return existing;
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) ||
        !create
      )
        throw error;
    }
    await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(randomBytes(32));
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(temporary, filename);
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST"
        ))
          throw error;
      }
    } finally {
      await unlink(temporary).catch(() => {});
    }
    const created = await readPrivateFile(filename, 32);
    if (created.length !== 32) throw Error("Invalid local encryption key");
    return created;
  }
  const aad = Buffer.from(purpose);
  return {
    async seal(value) {
      const nonce = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", await key(true), nonce);
      cipher.setAAD(aad);
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
      if (value.length > maximumEnvelopeLength)
        throw Error("Invalid encrypted connection size");
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
        throw Error("Invalid encrypted connection envelope");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        await key(false),
        Buffer.from(nonce, "base64url"),
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(payload, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
