import { mkdir, realpath, lstat, open, link, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
export const desktopStoragePointer = z
  .object({
    format: z.literal("cadence-desktop-storage/1"),
    directory: z.uuid(),
    workspaceId: z.uuid(),
    sourceHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export type DesktopStoragePointer = z.infer<typeof desktopStoragePointer>;
export async function physicalStorageDirectory(directory: string) {
  const root = resolve(directory),
    info = await lstat(root);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await realpath(root)) !== root
  )
    throw Error("Desktop storage requires a physical private directory");
  return root;
}
export async function readDesktopPointer(profile: string) {
  try {
    return desktopStoragePointer.parse(
      JSON.parse(
        (
          await readPrivateFile(join(profile, "backend-active.json"), 4096)
        ).toString("utf8"),
      ),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw Error("Desktop storage activation metadata is invalid");
  }
}
export async function createStorageRoot(profile: string) {
  const directory = join(profile, "backend-data");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return physicalStorageDirectory(directory);
}
export async function publishDesktopPointer(
  profile: string,
  pointer: DesktopStoragePointer,
) {
  const temporary = join(profile, `.backend-active-${crypto.randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(
      JSON.stringify(desktopStoragePointer.parse(pointer)) + "\n",
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    // Publishing an exclusive hard link cannot replace a winner from another launch.
    await link(temporary, join(profile, "backend-active.json"));
  } finally {
    await unlink(temporary);
  }
}
