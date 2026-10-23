import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, lstat, rename } from "node:fs/promises";
import { dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(await readFile(resolve(root, "scripts/model-runtime-lock.json"), "utf8"));
if (process.platform !== lock.platform || process.arch !== lock.architecture)
  throw Error("This reviewed runtime bundle supports Windows x64. Other targets require their own reviewed lock.");
const destination = resolve(process.argv[2] ?? resolve(root, "next/runtime"));
await mkdir(destination, { recursive: true });
const files = [];
const runtimes = {};
for (const entry of lock.runtimes) {
  if (!/^(llama|whisper)$/.test(entry.kind) || !/^[a-z0-9.-]+$/.test(entry.version)) throw Error("Invalid runtime lock");
  const archive = resolve(destination, `${entry.kind}-${entry.version}.zip`);
  let bytes = await readFile(archive).catch(error => { if (error.code === "ENOENT") return null; throw error; });
  if (!bytes) {
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(new URL(response.url).hostname))
      throw Error("Runtime archive origin unavailable");
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > entry.archiveBytes) throw Error("Runtime archive exceeds its reviewed size");
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  }
  if (bytes.length !== entry.archiveBytes || digest(bytes) !== entry.archiveSha256) throw Error("Runtime archive checksum mismatch");
  await writeFile(archive, bytes);
  const directory = resolve(destination, `${entry.kind}-${entry.version}`);
  await mkdir(directory, { recursive: true });
  const paths = execFileSync("tar", ["-tf", archive], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  if (paths.some(path => path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.replaceAll("\\", "/").split("/").includes("..")))
    throw Error("Unsafe runtime archive path");
  execFileSync("tar", ["-xf", archive, "-C", directory], { windowsHide: true });
  const extracted = await inventory(directory);
  const executable = extracted.find(file => basename(file.path) === entry.executable);
  if (!executable || executable.sha256 !== entry.executableSha256) throw Error("Runtime executable checksum mismatch");
  files.push(...extracted);
  runtimes[entry.kind] = { path: executable.path, sha256: executable.sha256, version: entry.version };
}
const manifest = { format: "orvunia-model-runtimes/1", platform: process.platform, architecture: process.arch, files, runtimes };
const temporary = resolve(destination, `manifest-${randomUUID()}.tmp`);
await writeFile(temporary, JSON.stringify(manifest, null, 2) + "\n");
await rename(temporary, resolve(destination, "manifest.json"));
console.log(JSON.stringify({ event: "model_runtimes_prepared", platform: process.platform, files: files.length,
  runtimes: Object.keys(runtimes), manifestSha256: digest(Buffer.from(JSON.stringify(manifest))) }));

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function inventory(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    const info = await lstat(filename);
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw Error("Unsafe runtime file");
    if (info.isDirectory()) found.push(...await inventory(filename));
    else found.push({ path: relative(destination, filename).replaceAll("\\", "/"), sha256: digest(await readFile(filename)) });
  }
  return found.sort((left, right) => left.path.localeCompare(right.path));
}
