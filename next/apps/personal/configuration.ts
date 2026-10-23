import { join } from "node:path";
import { loadLocalSettings as loadSettings } from "../../packages/config/local.ts";
import type { RuntimeIdentity } from "../../packages/desktop/runtime-profile.ts";

export function personalSettings(
  environment: Record<string, string | undefined>,
  directory: string,
  identity: RuntimeIdentity,
) {
  if (
    environment.CADENCE_DEPLOYMENT &&
    environment.CADENCE_DEPLOYMENT !== "local"
  )
    throw Error("Personal startup requires local deployment");
  if (
    environment.CADENCE_BIND_HOST &&
    environment.CADENCE_BIND_HOST !== "127.0.0.1"
  )
    throw Error("Personal startup requires loopback binding");
  const port = environment.PORT || "9915";
  const origin = `http://127.0.0.1:${port}`;
  if (
    environment.CADENCE_PUBLIC_URL &&
    environment.CADENCE_PUBLIC_URL !== origin
  )
    throw Error("Personal origin must match the loopback listener");
  const settings = loadSettings({
    ...environment,
    CADENCE_DEPLOYMENT: "local",
    CADENCE_LOCAL_BROWSER: "true",
    CADENCE_BIND_HOST: "127.0.0.1",
    CADENCE_PUBLIC_URL: origin,
    PORT: port,
    CADENCE_LOCAL_TOKEN: identity.token,
    CADENCE_LOCAL_WORKSPACE: identity.workspaceId,
    CADENCE_SQLITE_PATH: join(directory, "cadence-next.sqlite"),
    CADENCE_OBJECT_DIRECTORY: join(directory, "objects"),
  });
  if (settings.CADENCE_DEPLOYMENT !== "local")
    throw Error("Personal startup requires local settings");
  return settings;
}
