import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
export async function verifyRuntimeFile(
  filename: string,
  expectedHash: string,
  signal: AbortSignal,
) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash))
    throw Error("Backend runtime checksum is invalid");
  const path = resolve(filename),
    stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > 512 * 1024 * 1024 ||
    (await realpath(path)) !== path
  )
    throw Error("Backend runtime must be a regular bundled file");
  const hash = createHash("sha256"),
    stream = createReadStream(path, { signal });
  for await (const chunk of stream) hash.update(chunk as Buffer);
  signal.throwIfAborted();
  if (!timingSafeEqual(hash.digest(), Buffer.from(expectedHash, "hex")))
    throw Error("Backend runtime integrity check failed");
  return path;
}
