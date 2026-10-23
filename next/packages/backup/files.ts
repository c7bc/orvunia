import { createHash } from "node:crypto";
import { lstat, realpath, mkdir, open } from "node:fs/promises";
import { resolve, join, dirname, sep } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
import { backupPath } from "./manifest.ts";
import { objectKey } from "../assets/keys.ts";
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function realDirectory(path: string) {
  const root = resolve(path),
    stat = await lstat(root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await realpath(root)) !== root
  )
    throw Error("Private backup directory must be a real directory");
  return root;
}
export async function freshDirectory(source: string, destination: string) {
  const root = await realDirectory(source),
    target = resolve(destination);
  if (root === target || target.startsWith(root + sep))
    throw Error("Backup and source must use separate directories");
  await realDirectory(dirname(target));
  await mkdir(target, { mode: 0o700 });
  await realDirectory(target);
  return { root, target };
}
async function relativeBytes(root: string, relative: string) {
  const filename = join(root, relative);
  await realDirectory(dirname(filename));
  const stat = await lstat(filename);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size === 0 ||
    stat.size > 512 * 1024 * 1024
  )
    throw Error("Invalid private backup file");
  return readPrivateFile(filename, stat.size);
}
export const privateBytes = (root: string, relative: string) =>
  relativeBytes(root, backupPath(relative));
export const privateObjectBytes = (root: string, key: string) =>
  relativeBytes(root, objectKey(key));
export async function writePrivate(
  root: string,
  relative: string,
  bytes: Uint8Array,
) {
  const filename = join(
      root,
      ["backup-manifest.json", "restore-manifest.json"].includes(relative)
        ? relative
        : backupPath(relative),
    ),
    parent = dirname(filename);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await realDirectory(parent);
  const handle = await open(filename, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export const missing = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
