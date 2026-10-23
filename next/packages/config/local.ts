import { z } from "zod";

const schema = z.object({
  CADENCE_DEPLOYMENT: z.literal("local").default("local"),
  CADENCE_ASSET_QUOTA_BYTES: z.coerce.number().int().min(4 * 1024 * 1024)
    .max(10 * 1024 * 1024 * 1024).default(128 * 1024 * 1024),
  CADENCE_BIND_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(9915),
  CADENCE_PUBLIC_URL: z.url().default("http://127.0.0.1:9915"),
  CADENCE_LOCAL_BROWSER: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  CADENCE_OBJECT_DIRECTORY: z.string().min(1).optional(),
  CADENCE_SQLITE_PATH: z.string().min(1).default("data/cadence-next.sqlite"),
  CADENCE_LOCAL_TOKEN: z.string().min(32).max(256),
  CADENCE_LOCAL_WORKSPACE: z.uuid(),
});
export function loadLocalSettings(environment: Record<string, string | undefined>) {
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(environment)
    .filter(([, value]) => value !== undefined && value !== "")));
  if (!parsed.success) throw Error(`Invalid configuration: ${parsed.error.issues
    .map(issue => issue.path.join(".")).join(", ")}`);
  const origin = new URL(parsed.data.CADENCE_PUBLIC_URL);
  if (origin.origin !== parsed.data.CADENCE_PUBLIC_URL || origin.username ||
      origin.password || origin.hostname !== "127.0.0.1")
    throw Error("Personal local deployments must use a loopback origin");
  return parsed.data;
}
export type LocalSettings = ReturnType<typeof loadLocalSettings>;
