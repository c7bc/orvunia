import { realpath, lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { readPrivateFile } from "../providers/private-file.ts";
export const fileDigest = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
export async function releaseFile(root: string, path: string, maximum: number) {
  const filename = resolve(root, path),
    actual = await realpath(filename);
  if (
    !actual.startsWith(root + sep) ||
    actual !== filename ||
    !(await lstat(filename)).isFile()
  )
    throw Error("Runtime resource is outside its physical package");
  return readPrivateFile(filename, maximum);
}
export async function verifyReleaseFiles(
  root: string,
  files: readonly { path: string; sha256: string; bytes?: number }[],
  signal: AbortSignal,
) {
  const seen = new Set<string>();
  for (const file of files) {
    signal.throwIfAborted();
    if (seen.has(file.path)) throw Error("Runtime manifest repeats a file");
    seen.add(file.path);
    const data = await releaseFile(root, file.path, 32 * 1024 * 1024);
    if (
      fileDigest(data) !== file.sha256 ||
      (file.bytes !== undefined && data.byteLength !== file.bytes)
    )
      throw Error("Runtime resource integrity check failed");
  }
  signal.throwIfAborted();
}
