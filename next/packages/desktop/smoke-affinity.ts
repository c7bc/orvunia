import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import type { PlatformWindow } from "./platform-window.ts";
export function verifyWindowAffinity(
  window: PlatformWindow,
  directory: string,
  platform: string,
): unknown {
  if (platform !== "win32") return { supported: false };
  try {
    const handle = window.getNativeWindowHandle().readBigUInt64LE().toString(),
      script = readFileSync(join(directory, "affinity.ps1"), "utf8");
    return JSON.parse(
      execFileSync(
        "powershell.exe",
        ["-NoProfile", "-Command", `& { ${script} } -WindowHandle ${handle}`],
        { encoding: "utf8", windowsHide: true, timeout: 10000 },
      ),
    );
  } catch (error) {
    return {
      error: (error instanceof Error
        ? error.message
        : "Affinity verification failed"
      ).slice(0, 200),
    };
  }
}
