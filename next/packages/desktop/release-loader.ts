import { realpath, lstat } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { runtimeRelease, runtimeSources, runtimeClient } from "./release.ts";
import { clientCatalog } from "../client/catalog.ts";
import { bundledRuntimes } from "../local-models/bundled.ts";
import {
  releaseFile,
  fileDigest,
  verifyReleaseFiles,
} from "./release-files.ts";
export async function loadRuntimeRelease(
  directory: string,
  signal: AbortSignal,
  host = { platform: process.platform, architecture: process.arch },
) {
  signal.throwIfAborted();
  const root = await realpath(resolve(directory));
  if (
    !(await lstat(root)).isDirectory() ||
    root.split(sep).some((part) => part.endsWith(".asar"))
  )
    throw Error("Runtime requires a physical resource directory");
  const release = runtimeRelease.parse(
    JSON.parse(
      (await releaseFile(root, "backend-release.json", 16384)).toString("utf8"),
    ),
  );
  if (
    release.platform !== host.platform ||
    release.architecture !== host.architecture ||
    release.executable !== (host.platform === "win32" ? "bun.exe" : "bun")
  )
    throw Error("Runtime does not support this platform and architecture");
  const sources = await releaseFile(
    root,
    "backend/source-manifest.json",
    512 * 1024,
  );
  const client = await releaseFile(
    root,
    "client/client-manifest.json",
    256 * 1024,
  );
  if (
    fileDigest(sources) !== release.sourceManifestSha256 ||
    fileDigest(client) !== release.clientManifestSha256
  )
    throw Error("Runtime package manifest integrity check failed");
  const sourceManifest = runtimeSources.parse(
    JSON.parse(sources.toString("utf8")),
  );
  if (
    !sourceManifest.files.some(
      (file) => file.path === "apps/desktop/server.ts",
    ) ||
    !sourceManifest.files.some((file) => file.path === "package.json") ||
    !sourceManifest.files.some((file) => file.path === "bun.lock")
  )
    throw Error("Runtime source manifest is incomplete");
  await verifyReleaseFiles(join(root, "backend"), sourceManifest.files, signal);
  const clientManifest = runtimeClient.parse(
    JSON.parse(client.toString("utf8")),
  );
  await verifyReleaseFiles(join(root, "client"), clientManifest.files, signal);
  const publicFiles = new Set(clientManifest.files.map((file) => file.path));
  if (
    !publicFiles.has("desktop.html") ||
    !publicFiles.has("desktop.js") ||
    !publicFiles.has("assets/client-routes.json")
  )
    throw Error("Runtime client manifest is incomplete");
  for (const filename of (await clientCatalog(join(root, "client"))).values())
    if (!publicFiles.has(filename))
      throw Error("Runtime client catalog has an unverified file");
  const modelRuntimeDirectory = join(root, "models");
  if (release.modelRuntimeManifestSha256) {
    const manifest = await releaseFile(root, "models/manifest.json", 128 * 1024);
    if (fileDigest(manifest) !== release.modelRuntimeManifestSha256)
      throw Error("Model runtime manifest integrity check failed");
    await bundledRuntimes(modelRuntimeDirectory, true);
  }
  return {
    release,
    root,
    executable: join(root, release.executable),
    entrypoint: join(root, "backend/apps/desktop/server.ts"),
    directory: join(root, "backend"),
    clientDirectory: join(root, "client"),
    ...(release.modelRuntimeManifestSha256 ? { modelRuntimeDirectory } : {}),
  };
}
