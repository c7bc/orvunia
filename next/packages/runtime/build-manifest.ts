import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
export async function verifyBuildManifest(
  root: string,
  filename: string,
  format: string,
) {
  const file = z
    .object({
      path: z
        .string()
        .regex(/^[A-Za-z0-9./-]+$/)
        .refine(
          (path) =>
            !path.startsWith("/") &&
            !path
              .split("/")
              .some((part) => !part || part === "." || part === ".."),
        ),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
  const manifest = z
    .object({
      format: z.literal(format),
      sources: z.array(file).min(1).max(10000),
      bundles: z.array(file).min(1).max(1000),
    })
    .strict()
    .parse(JSON.parse(await readFile(resolve(root, filename), "utf8")));
  for (const entry of [...manifest.sources, ...manifest.bundles]) {
    const digest = createHash("sha256")
      .update(await readFile(resolve(root, entry.path)))
      .digest("hex");
    if (digest !== entry.sha256)
      throw Error(`Generated artifact is stale: ${entry.path}`);
  }
  return { sources: manifest.sources.length, bundles: manifest.bundles.length };
}
