import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
export async function readExternalEnvironment(options: {
  path: string;
  distro: string;
  signal: AbortSignal;
}) {
  options.signal.throwIfAborted();
  if (process.platform === "win32" && options.path.startsWith("/")) {
    const result = await promisify(execFile)(
      "wsl.exe",
      ["-d", options.distro, "--", "cat", "--", options.path],
      {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        signal: options.signal,
      },
    );
    return result.stdout;
  }
  if (!isAbsolute(options.path))
    throw Error("External provider configuration requires an absolute path");
  const bytes = await readPrivateFile(options.path, 1024 * 1024);
  options.signal.throwIfAborted();
  return bytes.toString("utf8");
}
