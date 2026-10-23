import { copyFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyRuntimeFile } from "./runtime-file.ts";
import { runtimeDestination } from "./package-destination.ts";
import { runtimeIdentity, installRuntimeDependencies } from "./package-command.ts";
import { packageClient } from "../client/package.ts";
import { packagePublicSources } from "./public-sources.ts";
import { runtimeRelease } from "./release.ts";
import { fileDigest } from "./release-files.ts";
import { loadRuntimeRelease } from "./release-loader.ts";
import { packageModelRuntimes } from "./package-models.ts";
export async function packagePublicRuntime(options: {
  source: string; destination: string; binary: string; checksum: string; signal: AbortSignal;
  modelRuntimeDirectory?: string;
}) {
  const binary = await verifyRuntimeFile(options.binary, options.checksum, options.signal);
  const identity = await runtimeIdentity(binary, options.source, options.signal);
  const output = await runtimeDestination(options.source, options.destination);
  try {
    const backend = join(output.target, "backend"), executable = identity.platform === "win32" ? "bun.exe" : "bun";
    const runtime = join(output.target, executable);
    await copyFile(binary, runtime); await chmod(runtime, 0o755);
    await verifyRuntimeFile(runtime, options.checksum, options.signal); await mkdir(backend);
    const sources = await packagePublicSources(output.source, backend, options.signal);
    await installRuntimeDependencies(runtime, backend, options.signal);
    const client = await packageClient(output.source, join(output.target, "client"), { vendorDirectory: backend });
    const metadata: unknown = JSON.parse(await readFile(join(output.source, "package.json"), "utf8"));
    if (!metadata || typeof metadata !== "object" || !("version" in metadata) || typeof metadata.version !== "string")
      throw Error("Public product version is missing");
    const modelRuntimes = await packageModelRuntimes(options.modelRuntimeDirectory ?? join(output.source, "next/runtime"), join(output.target, "models"), options.signal);
    const release = runtimeRelease.parse({ format: "cadence-native-runtime/1", version: metadata.version,
      bunVersion: identity.version, platform: identity.platform, architecture: identity.architecture,
      executable, executableSha256: options.checksum, sourceManifestSha256: sources.sha256,
      clientManifestSha256: fileDigest(await readFile(join(output.target, "client/client-manifest.json"))),
      ...(modelRuntimes ? { modelRuntimeManifestSha256: modelRuntimes.manifestSha256 } : {}) });
    await writeFile(join(output.target, "backend-release.json"), JSON.stringify(release, null, 2) + "\n", { flag: "wx" });
    await loadRuntimeRelease(output.target, options.signal);
    return { release, sourceFiles: sources.manifest.files.length, clientFiles: client.files.length };
  } catch (error) { await output.discard(); throw error; }
}
