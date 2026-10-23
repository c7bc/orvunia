import { mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { clientArtifact } from "./artifact.ts";

export async function packageClient(
  source: string,
  destination: string,
  options: { vendorDirectory?: string } = {},
) {
  const root = await realpath(resolve(source));
  const target = resolve(destination);
  if (root === target || root.startsWith(target + sep))
    throw Error("Client package must use a fresh destination");
  const files = await clientArtifact(root, options.vendorDirectory);
  await mkdir(dirname(target), { recursive: true });
  await mkdir(target);
  const manifest = {
    format: "cadence-client/1" as const,
    files: files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  };
  try {
    for (const file of files) {
      const filename = resolve(target, file.path);
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, file.data, { flag: "wx" });
    }
    await writeFile(
      resolve(target, "client-manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx" },
    );
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
  return manifest;
}
