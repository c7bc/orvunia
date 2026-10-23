import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { systemAudioBootstrap } from "../../packages/desktop/system-audio/bootstrap.ts";

const syntheticBootstrap = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  $directory = [Environment]::GetEnvironmentVariable('ORVUNIA_SYSTEM_AUDIO_DIRECTORY')
  $sources = @('endpoints-interfaces.cs', 'audio-interfaces.cs', 'endpoints.cs', 'format.cs',
    'converter.cs', 'protocol.cs', 'capture.cs', 'host.cs') | ForEach-Object { Join-Path $directory $_ }
  $sources += [Environment]::GetEnvironmentVariable('ORVUNIA_SYSTEM_AUDIO_TEST_SOURCE')
  Add-Type -Path $sources -ReferencedAssemblies 'System.Web.Extensions' | Out-Null
  exit ([OrvuniaSystemAudio.AudioHost]::Run('selftest'))
} catch {
  [Console]::Error.WriteLine('{"event":"error","code":"helper_unavailable"}')
  exit 1
}
`;

export function syntheticAudioHelper(action: "selftest" | "capture", input = "") {
  const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const helper = fileURLToPath(new URL("../../packages/desktop/system-audio/helper.ps1", import.meta.url));
  return new Promise<{ exit: number | null; output: Buffer; status: string }>((resolve, reject) => {
    const child = spawn(executable, ["-NoProfile", "-NonInteractive", "-Command",
      action === "selftest" ? syntheticBootstrap : systemAudioBootstrap],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env,
      ORVUNIA_SYSTEM_AUDIO_DIRECTORY: dirname(helper), ORVUNIA_SYSTEM_AUDIO_ACTION: action,
      ...(action === "selftest" ? { ORVUNIA_SYSTEM_AUDIO_TEST_SOURCE:
        fileURLToPath(new URL("./system-audio-selftest.cs", import.meta.url)) } : {}) } });
    const output: Buffer[] = [], status: Buffer[] = [];
    let bytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(Error("Synthetic helper timeout")); }, 15_000);
    timer.unref();
    const append = (target: Buffer[], data: Buffer) => {
      bytes += data.length;
      if (bytes > 64 * 1024) { child.kill(); reject(Error("Synthetic helper exceeded output bound")); }
      else target.push(data);
    };
    child.stdout.on("data", (data: Buffer) => append(output, data));
    child.stderr.on("data", (data: Buffer) => append(status, data));
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (exit) => {
      clearTimeout(timer); resolve({ exit, output: Buffer.concat(output), status: Buffer.concat(status).toString("utf8") });
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => { if (error.code !== "EPIPE") reject(error); });
    child.stdin.end(input);
  });
}
