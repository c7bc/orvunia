import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
import type { RuntimeBinary } from "./runtime.ts";

const path = z.string().min(1).max(512).regex(/^[a-zA-Z0-9_./-]+$/)
  .refine(value => !value.startsWith("/") && value.split("/").every(part => part && part !== "." && part !== ".."));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const runtime = z.object({ path, sha256: hash, version: z.string().min(1).max(100) }).strict();
export const modelRuntimeManifest = z.object({ format: z.literal("orvunia-model-runtimes/1"),
  platform: z.enum(["win32", "linux", "darwin"]), architecture: z.enum(["x64", "arm64"]),
  files: z.array(z.object({ path, sha256: hash }).strict()).min(1).max(256),
  runtimes: z.object({ llama: runtime.optional(), whisper: runtime.optional() }).strict(),
}).strict();
export async function bundledRuntimes(directory: string, required: boolean) {
  let bytes: Buffer;
  try { bytes = await readPrivateFile(resolve(directory, "manifest.json"), 128 * 1024); }
  catch (error) {
    if (!required && error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw Error("Model runtime manifest cannot be read");
  }
  const manifest = modelRuntimeManifest.parse(JSON.parse(bytes.toString("utf8")));
  if (manifest.platform !== process.platform || manifest.architecture !== process.arch)
    throw Error("Bundled model runtimes do not support this platform");
  const root = await realpath(directory);
  if (new Set(manifest.files.map(file => file.path)).size !== manifest.files.length)
    throw Error("Duplicate model runtime file");
  for (const file of manifest.files) {
    const filename = await realpath(resolve(root, file.path));
    if (!filename.startsWith(root + sep)) throw Error("Model runtime escapes its directory");
    const contents = await readPrivateFile(filename, 64 * 1024 * 1024);
    if (createHash("sha256").update(contents).digest("hex") !== file.sha256)
      throw Error("Model runtime integrity check failed");
  }
  const binaries: { llama?: RuntimeBinary; whisper?: RuntimeBinary } = {};
  for (const kind of ["llama", "whisper"] as const) {
    const binary = manifest.runtimes[kind];
    if (!binary) continue;
    if (!manifest.files.some(file => file.path === binary.path && file.sha256 === binary.sha256))
      throw Error("Model runtime executable is not verified");
    binaries[kind] = { path: resolve(root, binary.path), sha256: binary.sha256, version: binary.version };
  }
  return binaries;
}
