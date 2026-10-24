import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { distributionDigest } from "./runtime-audit.mjs";
const require = createRequire(import.meta.url), builder = createRequire(require.resolve("electron-builder"));
export const asar = createRequire(builder.resolve("app-builder-lib"))("@electron/asar");
export async function auditArchive(source, output) {
  const archive = join(output, "win-unpacked/resources/app.asar");
  const names = ["main.cjs", "runtime.cjs", "preload.cjs", "preload-personal.cjs", "preload-auxiliary.cjs", "affinity.ps1"];
  const allowed = new Set(["/desktop", "/desktop/system-audio", "/assets", "/assets/licenses", "/assets/icon.ico", "/assets/icon.png",
    "/package.json", "/LICENSE", "/THIRD_PARTY_NOTICES.txt", ...names.map(file => "/desktop/" + file)]);
  for (const file of await readdir(join(source, "assets/licenses"))) allowed.add("/assets/licenses/" + file);
  const helpers = await readdir(join(source, "desktop/system-audio")); assert.ok(helpers.length >= 2);
  for (const file of helpers) {
    assert.ok(file === "manifest.json" || /^[a-z0-9-]+\.(cs|ps1)$/.test(file));
    allowed.add("/desktop/system-audio/" + file);
    assert.equal(await distributionDigest(join(output, "win-unpacked/resources/app.asar.unpacked/desktop/system-audio", file)),
      await distributionDigest(join(source, "desktop/system-audio", file)));
  }
  const entries = asar.listPackage(archive).map(path => path.replaceAll("\\", "/"));
  assert.ok(entries.every(path => allowed.has(path)), "Unexpected ASAR payload");
  for (const file of names) assert.equal(createHash("sha256").update(asar.extractFile(archive, "desktop/" + file)).digest("hex"),
    await distributionDigest(join(source, "desktop", file)));
  const metadata = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
  assert.equal(metadata.name, "orvunia-qa"); assert.equal(metadata.version, "4.10.3");
  return { archiveSha256: await distributionDigest(archive), helperFiles: helpers.length, metadata };
}
