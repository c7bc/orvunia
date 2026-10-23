import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
export async function atomicWrite(filename: string, payload: string) {
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(payload); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, filename);
    if (process.platform !== "win32") {
      const directory = await open(dirname(filename), "r");
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!missingFile(error)) throw error;
    });
  }
}
export function missingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
