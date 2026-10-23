import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { relative, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { verifyCopiedNativeAudioResources } from "./native-audio-resources.mjs";

export async function productProvenance(root, configuration, builds) {
  await verifyCopiedNativeAudioResources(root, builds.audioResources.manifest);
  const digest = async file => ({ path: file, sha256: createHash("sha256")
    .update(await readFile(resolve(root, file))).digest("hex") });
  const sourceNames = build => Object.keys(build.metafile.inputs).map(file => relative(root, resolve(root, file)).replaceAll("\\", "/"))
    .filter(file => !file.includes("node_modules/") && !file.startsWith("../"));
  const outputNames = build => Object.keys(build.metafile.outputs).map(file => relative(root, resolve(root, file)).replaceAll("\\", "/"));
  const common = configuration.edition === "personal" ? ["product.json", "scripts/product-build.mjs", "scripts/product-provenance.mjs", "scripts/native-audio-resources.mjs"]
    : ["product.json", "vendor/core-integrity.json"];
  async function manifest(filename, format, sources, bundles) {
    await mkdir(dirname(resolve(root, filename)), { recursive: true });
    await writeFile(resolve(root, filename), JSON.stringify({ format,
      sources: await Promise.all([...new Set([...common, ...sources])].sort().map(digest)),
      bundles: await Promise.all([...new Set(bundles)].sort().map(digest)),
    }, null, 2) + "\n");
  }
  const styleSources = configuration.styles.flatMap(group => group.sources).filter(file => !file.startsWith("@orvunia/core/"));
  await manifest("client/bundles.json", "cadence-client-bundles/1", [...sourceNames(builds.client), ...styleSources],
    [...outputNames(builds.client), ...configuration.styles.map(group => group.path)]);
  await manifest("client/styles/bundles.json", "cadence-client-styles/1", styleSources,
    configuration.styles.map(group => group.path));
  await manifest("desktop/bundles.json", "cadence-desktop-bundles/1",
    [...sourceNames(builds.native), ...(configuration.edition === "personal" ? builds.audioResources.sources : [])],
    [...outputNames(builds.native), ...builds.audioResources.bundles]);
  const contracts = configuration.edition === "personal" ? (await readdir(resolve(root, "client/notes-rich")))
    .filter(file => file.endsWith(".ts")).map(file => `client/notes-rich/${file}`) : [];
  await manifest("client/notes-rich/bundles.json", "cadence-notes-editor-bundles/1", [...sourceNames(builds.notes), ...contracts],
    ["assets/editor/notes-rich.js", "assets/editor/LICENSES.txt", "assets/editor/PROVENANCE.json"]);
}
