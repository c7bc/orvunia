import { z } from "zod";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const relativePath = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_@./-]+$/)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      value.split("/").every((part) => part && !part.startsWith(".")),
  );
export const runtimeRelease = z
  .object({
    format: z.literal("cadence-native-runtime/1"),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
    bunVersion: z.literal("1.4.3"),
    platform: z.enum(["win32", "linux", "darwin"]),
    architecture: z.enum(["x64", "arm64"]),
    executable: z.enum(["bun", "bun.exe"]),
    executableSha256: digest,
    sourceManifestSha256: digest,
    clientManifestSha256: digest,
    modelRuntimeManifestSha256: digest.optional(),
  })
  .strict();
export const runtimeSources = z
  .object({
    format: z.literal("cadence-native-sources/1"),
    files: z
      .array(
        z
          .object({
            path: relativePath.refine((value) =>
              /^(?:(?:apps|packages|db|scripts)\/.*\.(?:ts|sql)|packages\/desktop\/system-audio\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:cs|ps1)|package\.json|bun\.lock)$/.test(
                value,
              ),
            ),
            sha256: digest,
          })
          .strict(),
      )
      .min(1)
      .max(2000),
  })
  .strict();
export const runtimeClient = z
  .object({
    format: z.literal("cadence-client/1"),
    files: z
      .array(
        z
          .object({
            path: relativePath,
            sha256: digest,
            bytes: z
              .number()
              .int()
              .nonnegative()
              .max(32 * 1024 * 1024),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();
export type RuntimeRelease = z.infer<typeof runtimeRelease>;
