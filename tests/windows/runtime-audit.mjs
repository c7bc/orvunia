import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

export async function distributionDigest(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}

export async function verifyPublicDistribution(source, directory) {
  const require = createRequire(join(source, "package.json"));
  const metadata = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  assert.equal(metadata.name, "@orvunia/core");
  const { loadRuntimeRelease } = require(join(source, "desktop/runtime.cjs"));
  const resources = await loadRuntimeRelease(directory, new AbortController().signal);
  for (const name of ["desktop/bundles.json", "client/bundles.json"]) {
    const manifest = JSON.parse(await readFile(join(source, name), "utf8"));
    for (const file of [...manifest.sources, ...manifest.bundles])
      assert.equal(await distributionDigest(join(source, file.path)), file.sha256, `Stale public source: ${file.path}`);
  }
  const backend = JSON.parse(await readFile(join(resources.directory, "source-manifest.json"), "utf8"));
  for (const file of backend.files) {
    const original = ["package.json", "bun.lock"].includes(file.path) ? join(source, file.path) : join(source, "next", file.path);
    assert.equal(await distributionDigest(original), file.sha256, `Packaged public backend differs: ${file.path}`);
  }
  const client = JSON.parse(await readFile(join(resources.clientDirectory, "client-manifest.json"), "utf8"));
  for (const file of client.files) {
    const original = join(file.path.startsWith("node_modules/") ? resources.directory : source, file.path);
    assert.equal(await distributionDigest(original), file.sha256, `Packaged public client differs: ${file.path}`);
  }
  assert.equal(await distributionDigest(resources.executable), resources.release.executableSha256);
  return resources;
}
