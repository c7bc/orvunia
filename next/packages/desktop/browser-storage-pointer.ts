import { open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
import { desktopBrowserOrigin } from "./browser-storage-plan.ts";

const filename = "browser-storage-origin.json";
export async function readBrowserStorageOrigin(profile: string) {
  let content: Buffer;
  try {
    content = await readPrivateFile(join(profile, filename), 2048);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid browser storage origin metadata");
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== 2 ||
    data.format !== "cadence-browser-storage/1" ||
    typeof data.origin !== "string"
  )
    throw Error("Invalid browser storage origin metadata");
  return desktopBrowserOrigin(data.origin);
}
export async function writeBrowserStorageOrigin(
  profile: string,
  origin: string,
) {
  desktopBrowserOrigin(origin);
  const temporary = join(profile, `.browser-origin-${crypto.randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(
        JSON.stringify({ format: "cadence-browser-storage/1", origin }) + "\n",
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, join(profile, filename));
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
