import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { LocalModelError } from "./domain.ts";
import type { RuntimeBinary } from "./runtime.ts";

export async function verifyRuntime(binary: RuntimeBinary): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(binary.sha256) || !binary.version.trim()) throw new LocalModelError("runtime_manifest_invalid");
  const initial = await lstat(binary.path);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.nlink !== 1) throw new LocalModelError("runtime_path_invalid");
  const handle = await open(binary.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (stat.ino !== initial.ino || stat.dev !== initial.dev || stat.size !== initial.size) throw new LocalModelError("runtime_changed");
    const hash = createHash("sha256");
    const bytes = Buffer.alloc(1024 * 1024);
    for (let offset = 0; offset < stat.size;) {
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, offset);
      if (!bytesRead) throw new LocalModelError("runtime_changed");
      hash.update(bytes.subarray(0, bytesRead)); offset += bytesRead;
    }
    if (hash.digest("hex") !== binary.sha256) throw new LocalModelError("runtime_hash_mismatch");
  } finally { await handle.close(); }
}
export function spawnRuntime(binary: RuntimeBinary, argumentsList: string[], directory: string): ChildProcess {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return spawn(binary.path, argumentsList, { cwd: directory, env: environment, shell: false, windowsHide: true, stdio: "ignore" });
}
export function processCompletion(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new LocalModelError("runtime_launch_failed", 503)));
    child.once("exit", (code) => resolve(code));
  });
}
export async function stopOwnedProcess(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([exited, new Promise<void>((resolve) => { timer = setTimeout(resolve, 3000); })]);
  if (timer) clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}
