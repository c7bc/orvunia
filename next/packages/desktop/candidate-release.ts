import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { verifyBuildManifest } from "../runtime/build-manifest.ts";
import { clientArtifact } from "../client/artifact.ts";
import { loadRuntimeRelease } from "./release-loader.ts";
import { runtimeSources, runtimeClient } from "./release.ts";
import { fileDigest, releaseFile } from "./release-files.ts";
import { runtimeSourcePaths } from "./runtime-source-paths.ts";

type Digest = { path: string; sha256: string };
export function assertCandidateContents(
  expected: readonly Digest[],
  packaged: readonly Digest[],
  name: string,
) {
  const files = new Map(packaged.map((file) => [file.path, file.sha256]));
  if (
    files.size !== packaged.length ||
    expected.length !== files.size ||
    expected.some((file) => files.get(file.path) !== file.sha256)
  )
    throw Error(
      `Candidate ${name} differs from the verified application sources`,
    );
}
export async function verifyCandidateRelease(
  source: string,
  directory: string,
  signal: AbortSignal,
) {
  const resources = await loadRuntimeRelease(directory, signal);
  await verifyBuildManifest(
    source,
    "desktop/bundles.json",
    "cadence-desktop-bundles/1",
  );
  await verifyBuildManifest(
    source,
    "client/bundles.json",
    "cadence-client-bundles/1",
  );
  const next = join(source, "next");
  const paths = await runtimeSourcePaths(next, signal);
  const backend = [];
  for (const path of paths) {
    signal.throwIfAborted();
    backend.push({
      path,
      sha256: fileDigest(await releaseFile(next, path, 2 * 1024 * 1024)),
    });
  }
  const packagedBackend = runtimeSources.parse(
    JSON.parse(
      await readFile(join(resources.directory, "source-manifest.json"), "utf8"),
    ),
  );
  assertCandidateContents(backend, packagedBackend.files, "backend");
  const client = await clientArtifact(source, next);
  const packagedClient = runtimeClient.parse(
    JSON.parse(
      await readFile(
        join(resources.clientDirectory, "client-manifest.json"),
        "utf8",
      ),
    ),
  );
  assertCandidateContents(client, packagedClient.files, "client");
  signal.throwIfAborted();
  return resources;
}
