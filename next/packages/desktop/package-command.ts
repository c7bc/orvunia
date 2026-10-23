import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
const execute = promisify(execFile);
const allowedEnvironment = [
  "PATH",
  "SystemRoot",
  "USERPROFILE",
  "HOME",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "BUN_INSTALL_CACHE_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
];
function environment() {
  return Object.fromEntries(
    allowedEnvironment.flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]!]],
    ),
  );
}
async function command(
  binary: string,
  args: string[],
  directory: string,
  signal: AbortSignal,
  timeout: number,
) {
  try {
    return await execute(binary, args, {
      cwd: directory,
      signal,
      timeout,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 65536,
      env: environment(),
    });
  } catch {
    signal.throwIfAborted();
    throw Error("Native runtime command failed");
  }
}
export async function runtimeIdentity(
  binary: string,
  directory: string,
  signal: AbortSignal,
) {
  const result = await command(
    binary,
    [
      "--eval",
      "console.log(JSON.stringify({version:process.versions.bun,platform:process.platform,architecture:process.arch}))",
    ],
    directory,
    signal,
    10000,
  );
  const identity = z
    .object({
      version: z.literal("1.4.3"),
      platform: z.enum(["win32", "linux", "darwin"]),
      architecture: z.enum(["x64", "arm64"]),
    })
    .strict()
    .parse(JSON.parse(String(result.stdout)));
  if (
    identity.platform !== process.platform ||
    identity.architecture !== process.arch
  )
    throw Error("Native packaging requires a runtime for the current host");
  return identity;
}
export async function installRuntimeDependencies(
  binary: string,
  directory: string,
  signal: AbortSignal,
) {
  await command(
    binary,
    ["install", "--production", "--frozen-lockfile", "--ignore-scripts"],
    directory,
    signal,
    600000,
  );
}
