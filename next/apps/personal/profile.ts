import { Database } from "bun:sqlite";
import { mkdirSync, lstatSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { prepareRuntimeProfile } from "../../packages/desktop/runtime-profile.ts";
import { assertPersonalDirectory } from "./profile-guard.ts";

export function personalProfile(selected: string) {
  const directory = resolve(selected);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory) !== directory)
    throw Error("Personal profile must be a physical directory");
  assertPersonalDirectory(directory);
  const filename = join(directory, ".personal-lock.sqlite");
  try {
    const existing = lstatSync(filename);
    if (!existing.isFile() || existing.isSymbolicLink())
      throw Error("Invalid personal profile lock");
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
  const lock = new Database(filename, { create: true, strict: true });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    lock.close(true);
  };
  try {
    // SQLite owns the OS lock until this connection closes, including crash recovery.
    lock.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;");
    const identity = prepareRuntimeProfile({ directory, ownsLock: true });
    return { directory, identity, close };
  } catch {
    close();
    throw Error("Personal profile is unavailable, invalid, or already in use");
  }
}
