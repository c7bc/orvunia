import { realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { verifyReleaseFiles } from "../release-files.ts";
import { systemAudioResourceManifest } from "./resource-manifest.ts";

export function systemAudioDirectory(desktopDirectory: string, packaged: boolean) {
  const parts = resolve(desktopDirectory).split(sep);
  if (packaged) {
    const index = parts.lastIndexOf("app.asar");
    if (index !== -1) parts[index] = "app.asar.unpacked";
  }
  return join(parts.join(sep), "system-audio");
}

export async function verifySystemAudioResources(directory: string, signal: AbortSignal,
  manifest: { format: string; files: readonly { path: string; sha256: string; bytes?: number }[] } = systemAudioResourceManifest) {
  if (manifest.format !== "orvunia-system-audio-resources/1" || manifest.files.length < 2 || manifest.files.length > 64
    || !manifest.files.some((file) => file.path === "helper.ps1")
    || manifest.files.some((file) => !/^[a-z0-9-]+\.(cs|ps1)$/.test(file.path))) throw Error("System audio resource manifest is invalid");
  const root = resolve(directory);
  if (await realpath(root) !== root) throw Error("System audio resources must be physical package files");
  await verifyReleaseFiles(root, manifest.files, signal);
  return root;
}
