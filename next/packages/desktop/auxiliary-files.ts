import { readFile, lstat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { NativeContext } from "./application-types.ts";
import type { PlatformWindow } from "./platform-window.ts";

const media: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".json": "application/json", ".pdf": "application/pdf",
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv" };
export async function chooseAuxiliaryFiles(context: NativeContext, window: PlatformWindow | null,
  accept: string, multiple: boolean) {
  context.abort.signal.throwIfAborted();
  const extensions = [...new Set(accept.split(",").flatMap(item => item.trim().startsWith(".")
    ? [item.trim().slice(1)] : Object.entries(media).filter(([, type]) => type === item.trim()).map(([extension]) => extension.slice(1))))]
    .filter(extension => /^[a-z0-9]{1,10}$/.test(extension));
  const result = await context.electron.dialog.showOpenDialog(window, {
    properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: extensions.length ? [{ name: "Files", extensions }] : [],
  });
  context.abort.signal.throwIfAborted();
  if (result.canceled) return [];
  if (result.filePaths.length > (multiple ? 20 : 1)) throw Error("auxiliary_file_limit");
  let total = 0;
  const files = [];
  for (const path of result.filePaths) {
    const information = await lstat(path);
    total += information.size;
    if (!information.isFile() || information.isSymbolicLink() || information.size > 24 * 1024 * 1024
      || total > 32 * 1024 * 1024) throw Error("auxiliary_file_limit");
    const data = await readFile(path, { signal: context.abort.signal });
    if (data.length !== information.size) throw Error("auxiliary_file_changed");
    files.push({ name: basename(path), type: media[extname(path).toLowerCase()] ?? "application/octet-stream",
      data: data.toString("base64") });
  }
  return files;
}
