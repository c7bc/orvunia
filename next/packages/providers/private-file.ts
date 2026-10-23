import { lstat, open } from "node:fs/promises";
import { constants } from "node:fs";

export async function readPrivateFile(filename: string, maximum: number) {
  const initial = await lstat(filename);
  if (initial.isSymbolicLink() || !initial.isFile() || initial.size > maximum)
    throw Error("Invalid private file");
  const handle = await open(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.size > maximum ||
      opened.ino !== initial.ino ||
      opened.dev !== initial.dev
    )
      throw Error("Private file changed while opening");
    const bytes = Buffer.alloc(maximum + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maximum) throw Error("Private file exceeds its limit");
    return bytes.subarray(0, length);
  } finally {
    await handle.close();
  }
}
