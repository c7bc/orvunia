import { readdir, realpath, mkdir, writeFile } from "node:fs/promises";
import { join, dirname, sep } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
import { fileDigest } from "./release-files.ts";
type SourceFile = { source: string; target: string };
export async function packagePublicSources(source: string, target: string, signal: AbortSignal) {
  const root = await realpath(source), entries: SourceFile[] = [];
  const packageValue: unknown = JSON.parse((await readPrivateFile(join(root, "package.json"), 512 * 1024)).toString("utf8"));
  if (!packageValue || typeof packageValue !== "object" || !("name" in packageValue) || packageValue.name !== "@orvunia/core")
    throw Error("Public runtime requires the reviewed standalone core product");
  async function collect(directory: string) {
    signal.throwIfAborted();
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error("Public runtime cannot include symbolic links");
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && (/\.(ts|sql)$/.test(path)
        || /^next\/packages\/desktop\/system-audio\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:cs|ps1)$/.test(path)))
        entries.push({ source: path, target: path.slice("next/".length) });
      else throw Error("Unexpected public backend module");
    }
  }
  for (const directory of ["next/apps", "next/packages", "next/db/sqlite"]) await collect(directory);
  entries.push({ source: "package.json", target: "package.json" }, { source: "bun.lock", target: "bun.lock" });
  const files: { path: string; sha256: string }[] = [];
  for (const entry of entries.sort((first, second) => first.target.localeCompare(second.target, "en"))) {
    signal.throwIfAborted();
    const filename = join(root, entry.source), actual = await realpath(filename);
    if (actual !== filename || !actual.startsWith(root + sep)) throw Error("Public runtime source escapes its product");
    const data = await readPrivateFile(filename, 2 * 1024 * 1024);
    await mkdir(dirname(join(target, entry.target)), { recursive: true });
    await writeFile(join(target, entry.target), data, { flag: "wx" });
    files.push({ path: entry.target, sha256: fileDigest(data) });
  }
  const manifest = { format: "cadence-native-sources/1" as const, files };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(target, "source-manifest.json"), bytes, { flag: "wx" });
  return { manifest, sha256: fileDigest(bytes) };
}
