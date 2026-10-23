import {
  lstatSync,
  openSync,
  readSync,
  closeSync,
  fstatSync,
  mkdirSync,
  writeSync,
  fsyncSync,
  renameSync,
  unlinkSync,
  copyFileSync,
  constants,
} from "node:fs";
import { dirname } from "node:path";
import { defaultNativePreferences } from "./preference-defaults.ts";
import { restoreNativePreferences } from "./preference-validation.ts";
import type { NativePreferences } from "./preference-types.ts";

function read(filename: string) {
  const initial = lstatSync(filename);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.size > 65536)
    throw Error("Invalid native preferences file");
  const handle = openSync(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const current = fstatSync(handle);
    if (
      !current.isFile() ||
      current.ino !== initial.ino ||
      current.dev !== initial.dev ||
      current.size > 65536
    )
      throw Error("Native preferences changed during read");
    const bytes = Buffer.alloc(65537);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(
        handle,
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (!count) break;
      length += count;
    }
    if (length > 65536) throw Error("Native preferences exceed their limit");
    return bytes.subarray(0, length);
  } finally {
    closeSync(handle);
  }
}
export function loadNativePreferences(filename: string): NativePreferences {
  try {
    return restoreNativePreferences(
      JSON.parse(read(filename).toString("utf8")),
    );
  } catch {
    return defaultNativePreferences();
  }
}
export function saveNativePreferences(
  filename: string,
  value: NativePreferences,
) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  if (bytes.byteLength > 65536)
    throw Error("Native preferences exceed their limit");
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  try {
    const original = read(filename);
    try {
      restoreNativePreferences(JSON.parse(original.toString("utf8")));
    } catch {
      copyFileSync(
        filename,
        filename + `.invalid-${crypto.randomUUID()}`,
        constants.COPYFILE_EXCL,
      );
    }
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
  const temporary = filename + `.pending-${crypto.randomUUID()}`;
  try {
    const handle = openSync(temporary, "wx", 0o600);
    try {
      let offset = 0;
      while (offset < bytes.length)
        offset += writeSync(handle, bytes, offset, bytes.length - offset);
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    renameSync(temporary, filename);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {}
  }
}
