import { spawn } from "node:child_process";
import { join } from "node:path";
import type { LaunchHelper } from "./ports.ts";
import { systemAudioBootstrap } from "./bootstrap.ts";

export function systemAudioHelperEnvironment(environment: Record<string, string | undefined>) {
  const systemRoot = environment.SystemRoot || environment.SYSTEMROOT || "C:\\Windows";
  const executable = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const allowed = ["SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA"];
  const safeEnvironment = Object.fromEntries(allowed.flatMap((key) => environment[key] ? [[key, environment[key]!]] : []));
  safeEnvironment.PATH = join(systemRoot, "System32");
  return { executable, environment: safeEnvironment };
}

export function systemAudioHelper(directory: string,
  environment: Record<string, string | undefined> = process.env): LaunchHelper {
  const safe = systemAudioHelperEnvironment(environment);
  return (action, events) => {
    const child = spawn(safe.executable, ["-NoProfile", "-NonInteractive", "-Command", systemAudioBootstrap], {
      windowsHide: true, cwd: directory,
      env: { ...safe.environment, ORVUNIA_SYSTEM_AUDIO_DIRECTORY: directory, ORVUNIA_SYSTEM_AUDIO_ACTION: action },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let metadata = "", failed = false;
    const failure = () => {
      if (failed) return;
      failed = true;
      events.metadata({ event: "error", code: "helper_failed" });
    };
    child.stdout.on("data", (data: Buffer) => { if (!failed) events.data(new Uint8Array(data)); });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data: string) => {
      if (failed) return;
      metadata += data;
      if (Buffer.byteLength(metadata) > 65536) { failure(); return; }
      const lines = metadata.split(/\r?\n/); metadata = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try { events.metadata(JSON.parse(line)); } catch { failure(); }
      }
    });
    child.stdin.on("error", failure);
    child.on("error", failure);
    const closed = new Promise<number | null>((resolve) => {
      child.once("close", (code) => { events.exited(code); resolve(code); });
    });
    return {
      closed,
      command(value) {
        if (failed || child.stdin.destroyed) return false;
        try { child.stdin.write(JSON.stringify(value) + "\n"); return true; } catch { return false; }
      },
      endInput() { child.stdin.end(); },
      terminate() { child.kill("SIGKILL"); },
    };
  };
}
