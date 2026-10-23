import {
  mkdir,
  lstat,
  realpath,
  readFile,
  link,
  unlink,
  open,
  rename,
} from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { ObjectStore } from "./domain.ts";
import { objectKey } from "./keys.ts";

function isCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}
export async function filesystemObjects(
  directory: string,
): Promise<ObjectStore> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink())
    throw Error("Object directory cannot be a symbolic link");
  const root = await realpath(resolve(directory));
  async function location(key: string, create = false) {
    const file = join(root, ...objectKey(key).split("/")),
      parent = dirname(file);
    if (create) await mkdir(parent, { recursive: true, mode: 0o700 });
    const stat = await lstat(parent);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await realpath(parent)) !== parent
    )
      throw Error("Unsafe private object directory");
    return file;
  }
  async function get(key: string, maximumBytes: number, signal?: AbortSignal) {
    const file = await location(key),
      stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size === 0 ||
      stat.size > maximumBytes
    )
      throw Error("Invalid private object file");
    signal?.throwIfAborted();
    const data = await readFile(file, signal ? { signal } : {});
    if (data.length > maximumBytes)
      throw Error("Private object exceeds byte limit");
    return data;
  }
  return {
    get,
    async put(key, data) {
      if (!data.byteLength)
        throw Error("Empty private objects are reserved for deletion");
      const file = await location(key, true),
        temporary = `${file}.${crypto.randomUUID()}.upload`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(data);
          await handle.sync();
        } finally {
          await handle.close();
        }
        try {
          await link(temporary, file);
        } catch (error) {
          if (!isCode(error, "EEXIST")) throw error;
          const existing = await get(key, data.byteLength);
          if (
            existing.length !== data.byteLength ||
            !timingSafeEqual(existing, data)
          )
            throw Error("Private object identity has different content");
        }
      } finally {
        await unlink(temporary).catch((error) => {
          if (!isCode(error, "ENOENT")) throw error;
        });
      }
    },
    async remove(key, signal) {
      signal?.throwIfAborted();
      const file = await location(key, true),
        temporary = `${file}.${crypto.randomUUID()}.delete`;
      try {
        if (
          (
            await lstat(file).catch((error) => {
              if (!isCode(error, "ENOENT")) throw error;
              return null;
            })
          )?.isSymbolicLink()
        )
          throw Error("Unsafe private object file");
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch((error) => {
          if (!isCode(error, "ENOENT")) throw error;
        });
      }
    },
  };
}
