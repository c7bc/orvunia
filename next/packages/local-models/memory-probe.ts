import { execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type MemoryReading = { bytes: number; identity: string; source: "linux-proc-vmrss" | "windows-workingset" };
export type MemoryProbe = (child: ChildProcess, signal: AbortSignal) => Promise<MemoryReading>;
export function ownedProcessAlive(child: ChildProcess): boolean {
  return Number.isSafeInteger(child.pid) && child.pid! > 0 && child.exitCode === null && child.signalCode === null;
}
export function linuxMemory(stat: string, status: string): MemoryReading {
  const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
  const identity = fields[19];
  const match = /^VmRSS:\s+(\d+)\s+kB\s*$/m.exec(status);
  const bytes = match ? Number(match[1]) * 1024 : NaN;
  if (!identity || !/^\d+$/.test(identity) || !Number.isSafeInteger(bytes) || bytes < 0) throw Error("memory_probe_invalid");
  return { bytes, identity, source: "linux-proc-vmrss" };
}
export function windowsMemory(contents: string): MemoryReading {
  const value = JSON.parse(contents) as { bytes?: unknown; identity?: unknown };
  if (!Number.isSafeInteger(value.bytes) || Number(value.bytes) < 0 || typeof value.identity !== "string" || !/^\d+$/.test(value.identity))
    throw Error("memory_probe_invalid");
  return { bytes: Number(value.bytes), identity: value.identity, source: "windows-workingset" };
}
export function createMemoryProbe(input: {
  platform: string;
  read: (path: string, signal: AbortSignal) => Promise<string>;
  windows: (pid: number, signal: AbortSignal) => Promise<string>;
}): MemoryProbe {
  return async (child, signal) => {
    if (!ownedProcessAlive(child)) throw Error("memory_process_unavailable");
    const pid = child.pid!;
    let reading: MemoryReading;
    if (input.platform === "linux") {
      const [stat, status] = await Promise.all([
        input.read(`/proc/${pid}/stat`, signal), input.read(`/proc/${pid}/status`, signal),
      ]);
      reading = linuxMemory(stat, status);
    } else if (input.platform === "win32") reading = windowsMemory(await input.windows(pid, signal));
    else throw Error("memory_platform_unsupported");
    if (!ownedProcessAlive(child) || child.pid !== pid) throw Error("memory_process_unavailable");
    return reading;
  };
}
export const probeOwnedMemory: MemoryProbe = createMemoryProbe({
  platform: process.platform,
  read: (path, signal) => readFile(path, { encoding: "utf8", signal }),
  windows: (pid, signal) => new Promise((resolve, reject) => {
    const script = `$orvuniaProcess=Get-Process -Id ${pid} -ErrorAction Stop; `
      + "[pscustomobject]@{bytes=$orvuniaProcess.WorkingSet64;identity=$orvuniaProcess.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json -Compress";
    execFile(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 750, maxBuffer: 2048, signal },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  }),
});
