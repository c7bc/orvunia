import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
import { bundledRuntimes, modelRuntimeManifest } from "../local-models/bundled.ts";
import { fileDigest } from "./release-files.ts";

export async function packageModelRuntimes(directory: string, destination: string, signal: AbortSignal) {
  let bytes: Buffer;
  try { bytes = await readPrivateFile(resolve(directory, "manifest.json"), 128 * 1024); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  signal.throwIfAborted();
  await bundledRuntimes(directory, true);
  const manifest = modelRuntimeManifest.parse(JSON.parse(bytes.toString("utf8")));
  await mkdir(destination);
  for (const file of manifest.files) {
    signal.throwIfAborted();
    const contents = await readPrivateFile(resolve(directory, file.path), 64 * 1024 * 1024);
    if (fileDigest(contents) !== file.sha256) throw Error("Model runtime changed during packaging");
    const target = resolve(destination, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, { flag: "wx" });
  }
  await writeFile(resolve(destination, "manifest.json"), bytes, { flag: "wx" });
  return { manifestSha256: fileDigest(bytes) };
}
