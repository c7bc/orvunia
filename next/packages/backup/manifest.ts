import { z } from "zod";
import { objectKey } from "../assets/keys.ts";
export const privateFiles = [
  "providers.next.json",
  "providers.v2.json",
  "providers.v2.migration.json",
  "providers.next.json.key",
  "calendar.next.key",
  "legacy.snapshot.sqlite",
  "import-manifest.json",
  "external-env.json",
  "settings.json",
  "desktop.json",
  "desktop-auth-device.json",
  "legacy-files/providers.json",
  "legacy-files/external-env.json",
  "legacy-files/settings.json",
  "legacy-files/desktop.json",
  "legacy-files/desktop-auth-device.json",
  "legacy-files/.calendar-key",
  "legacy-files/onboarding.sqlite",
  "legacy-files/calendar.sqlite",
] as const;
export function backupPath(value: string) {
  if (
    value === "cadence-next.sqlite" ||
    (privateFiles as readonly string[]).includes(value)
  )
    return value;
  if (value.startsWith("objects/")) {
    objectKey(value.slice(8));
    return value;
  }
  throw Error("Unsupported private backup path");
}
export const backupEntry = z
  .object({
    path: z.string().transform(backupPath),
    bytes: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const backupManifest = z
  .object({
    format: z.literal("cadence-personal-backup/1"),
    createdAt: z.iso.datetime(),
    private: z.literal(true),
    encrypted: z.literal(false),
    quiesced: z.literal(true),
    osVaultPortable: z.literal(false),
    externalSecretsIncluded: z.literal(false),
    files: z.array(backupEntry).min(1).max(100000),
    migrations: z
      .array(
        z
          .object({
            name: z.string(),
            hash: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type PersonalBackup = z.infer<typeof backupManifest>;
export type BackupEntry = z.infer<typeof backupEntry>;
