import { createDecipheriv, createHash } from "node:crypto";
import type { SecretVault } from "../providers/domain.ts";
export function legacyCalendarVault(options: {
  vault?: SecretVault;
  localKey?: Uint8Array;
  secret?: string;
}) {
  const candidates: ((value: string) => Promise<string>)[] = [];
  if (options.vault) candidates.push((value) => options.vault!.open(value));
  const keys: Uint8Array[] = [];
  if (options.localKey) {
    if (options.localKey.byteLength !== 32)
      throw Error("Invalid legacy calendar key");
    keys.push(options.localKey);
  }
  if (options.secret) {
    if (options.secret.length < 32)
      throw Error("Invalid legacy calendar secret");
    keys.push(
      createHash("sha256")
        .update("cadence-calendar-v1\0" + options.secret)
        .digest(),
    );
  }
  for (const key of keys)
    candidates.push(async (value) => {
      if (value.length > 40000) throw Error("Invalid legacy calendar envelope");
      const bytes = Buffer.from(value, "base64url");
      if (bytes.length < 29) throw Error("Invalid legacy calendar envelope");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    });
  return async (value: string) => {
    for (const open of candidates) {
      try {
        return await open(value);
      } catch {}
    }
    throw Error(
      "Legacy calendar authorization cannot be opened with the available vault",
    );
  };
}
