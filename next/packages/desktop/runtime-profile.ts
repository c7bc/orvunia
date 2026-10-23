import {
  mkdirSync,
  realpathSync,
  openSync,
  closeSync,
  lstatSync,
  fstatSync,
  readSync,
  writeSync,
  fsyncSync,
  linkSync,
  unlinkSync,
  constants,
} from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";

const identity = z
  .object({
    format: z.literal("cadence-desktop-runtime/1"),
    workspaceId: z.uuid(),
    token: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  })
  .strict();
export type RuntimeProfile = z.infer<typeof identity>;
export type RuntimeIdentity = Pick<RuntimeProfile, "workspaceId" | "token">;
function readIdentity(filename: string): RuntimeProfile {
  const initial = lstatSync(filename);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.size > 2048)
    throw Error("Invalid runtime identity metadata");
  const handle = openSync(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const current = fstatSync(handle);
    if (
      !current.isFile() ||
      current.dev !== initial.dev ||
      current.ino !== initial.ino ||
      current.size > 2048
    )
      throw Error("Runtime identity changed while opening");
    const bytes = Buffer.alloc(2049);
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
    if (length > 2048) throw Error("Invalid runtime identity metadata");
    const parsed = identity.safeParse(
      JSON.parse(bytes.subarray(0, length).toString("utf8")),
    );
    if (!parsed.success) throw Error("Invalid runtime identity metadata");
    return parsed.data;
  } catch {
    throw Error("Invalid runtime identity metadata");
  } finally {
    closeSync(handle);
  }
}
function missing(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT",
  );
}
export function prepareRuntimeProfile(options: {
  directory: string;
  ownsLock: boolean;
}): RuntimeProfile {
  if (!options.ownsLock)
    throw Error(
      "Runtime identity requires the application's exclusive instance lock",
    );
  if (!isAbsolute(options.directory))
    throw Error("Runtime profile must use an absolute path");
  const directory = resolve(options.directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory) !== directory)
    throw Error("Runtime profile must be a physical directory");
  const filename = join(directory, "runtime-profile.json");
  try {
    return readIdentity(filename);
  } catch (error) {
    if (!missing(error)) throw error;
  }
  const value: RuntimeProfile = {
    format: "cadence-desktop-runtime/1",
    workspaceId: randomUUID(),
    token: randomBytes(32).toString("base64url"),
  };
  const temporary = join(directory, `.runtime-profile-${randomUUID()}.tmp`);
  try {
    const handle = openSync(temporary, "wx", 0o600),
      bytes = Buffer.from(JSON.stringify(value) + "\n");
    try {
      let offset = 0;
      while (offset < bytes.length)
        offset += writeSync(handle, bytes, offset, bytes.length - offset);
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    try {
      linkSync(temporary, filename);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "EEXIST"
      )
        throw error;
    }
    return readIdentity(filename);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {}
  }
}
