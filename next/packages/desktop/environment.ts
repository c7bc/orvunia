import { join } from "node:path";
import { parseEnv } from "node:util";
import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
import { personalEnvironmentKeys } from "./environment-keys.ts";
import { readExternalEnvironment } from "./external-environment.ts";
async function optionalPrivateFile(path: string) {
  try {
    return (await readPrivateFile(path, 1024 * 1024)).toString("utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw Error("Desktop provider configuration cannot be read");
  }
}
export async function desktopEnvironment(options: {
  root: string;
  dataDirectory: string;
  environment: Record<string, string | undefined>;
  signal: AbortSignal;
  readExternal?: typeof readExternalEnvironment;
  onExternalUnavailable?(): void;
}) {
  options.signal.throwIfAborted();
  const local = await optionalPrivateFile(join(options.root, ".env"));
  const environment = {
    ...(local ? parseEnv(local) : {}),
    ...Object.fromEntries(
      Object.entries(options.environment).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  };
  if (
    environment.CADENCE_DEPLOYMENT &&
    environment.CADENCE_DEPLOYMENT !== "local"
  )
    throw Error("Integrated desktop requires a personal local backend");
  const result: Record<string, string> = {};
  for (const key of personalEnvironmentKeys) {
    const value = environment[key];
    if (value !== undefined) {
      if (value.length > 60000)
        throw Error("Desktop configuration exceeds its value limit");
      result[key] = value;
    }
  }
  if (!result.OPENAI_API_KEY) {
    const saved = await optionalPrivateFile(
      join(options.dataDirectory, "external-env.json"),
    );
    let external: { path?: string | undefined; distro?: string | undefined } =
      {};
    try {
      if (saved)
        external = z
          .object({
            path: z.string().max(2048).optional(),
            distro: z.string().max(80).optional(),
          })
          .strict()
          .parse(JSON.parse(saved));
      const path = environment.ZAPYFLOW_ENV_PATH ?? external.path;
      if (path) {
        if (path.length > 2048 || path.includes("\0"))
          throw Error("Invalid external path");
        const distro =
          environment.ZAPYFLOW_WSL_DISTRO ?? external.distro ?? "Ubuntu";
        if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(distro))
          throw Error("Invalid external distribution");
        const text = await (options.readExternal ?? readExternalEnvironment)({
          path,
          distro,
          signal: options.signal,
        });
        if (Buffer.byteLength(text) > 1024 * 1024)
          throw Error("External environment exceeds its limit");
        const key = parseEnv(text).OPENAI_API_KEY;
        if (!key || key.length > 60000)
          throw Error("External OpenAI credential is unavailable");
        result.OPENAI_API_KEY = key;
      }
    } catch {
      options.signal.throwIfAborted();
      options.onExternalUnavailable?.();
    }
  }
  options.signal.throwIfAborted();
  return result;
}
