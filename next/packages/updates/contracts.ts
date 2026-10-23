import { z } from "zod";
export function releaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw Error("Invalid release URL");
  return url.href;
}
export const updateTarget = z
  .object({
    version: z.string().regex(/^\d{1,6}\.\d{1,6}\.\d{1,6}$/),
    platform: z.enum(["win32", "darwin", "linux"]),
    arch: z.enum(["x64", "arm64"]),
  })
  .strict();
export const releaseFeed = z
  .object({
    schema: z.literal(1),
    releases: z
      .array(
        updateTarget
          .extend({
            url: z.url().max(2048).transform(releaseUrl),
            sha256: z.string().regex(/^[a-f0-9]{64}$/i),
            notes: z.string().max(2000).default(""),
            publishedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
