import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { productProvenance } from "./product-provenance.mjs";
import { copyNativeAudioResources, verifyNativeAudioResourceManifest } from "./native-audio-resources.mjs";

const digest = data => createHash("sha256").update(data).digest("hex");
export async function buildProduct(directory) {
  const root = resolve(directory);
  const configuration = JSON.parse(await readFile(resolve(root, "product.json"), "utf8"));
  const require = createRequire(resolve(root, "package.json"));
  const entry = name => name.startsWith("@orvunia/core/") ? require.resolve(name) : resolve(root, name);
  const audioRoot = configuration.edition === "personal" ? root : dirname(require.resolve("@orvunia/core/package.json"));
  const audioSnapshot = await verifyNativeAudioResourceManifest(audioRoot);
  if (configuration.edition === "cloud") {
    const core = dirname(require.resolve("@orvunia/core/package.json"));
    const assets = JSON.parse(await readFile(resolve(core, "assets/static-manifest.json"), "utf8"));
    for (const name of assets.files) {
      await mkdir(dirname(resolve(root, name)), { recursive: true });
      await copyFile(resolve(core, name), resolve(root, name));
    }
  }
  const records = [];
  for (const group of configuration.styles) {
    const chunks = await Promise.all(group.sources.map(name => readFile(entry(name))));
    const data = Buffer.concat(chunks);
    await writeFile(resolve(root, group.path), data);
    records.push({ path: group.path, bytes: data.length, sha256: digest(data) });
  }
  const aliases = { "@cadence/components": "./panel-components.js", "@cadence/gaze-vision": "./vision_bundle.mjs",
    "@cadence/notes-rich": "./assets/editor/notes-rich.js", "@cadence/i18n": "./i18n-ui.js", "@cadence/icons": "./icons.js" };
  await mkdir(resolve(root, "locales"), { recursive: true });
  const result = await build({ absWorkingDir: root,
    entryPoints: Object.fromEntries(Object.entries(configuration.clientEntries).map(([name, source]) => [name, entry(source)])),
    outdir: root, bundle: true, format: "esm", platform: "browser", target: "chrome140", metafile: true,
    plugins: [{ name: "orvunia-browser-aliases", setup(builder) {
      builder.onResolve({ filter: /^@cadence\// }, ({ path }) => {
        if (!aliases[path]) throw Error(`Unknown browser alias: ${path}`);
        return { path: aliases[path], external: true };
      });
    } }], legalComments: "eof",
  });
  const native = await build({ absWorkingDir: root, entryPoints: [entry(configuration.nativeEntry)],
    outfile: resolve(root, "desktop/runtime.cjs"), bundle: true, platform: "node", target: "node24", format: "cjs", metafile: true });
  const audioResources = await copyNativeAudioResources(audioRoot, root, audioSnapshot);
  for (const path of audioResources.bundles) {
    const data = await readFile(resolve(root, path));
    records.push({ path, bytes: data.length, sha256: digest(data) });
  }
  const notes = await build({ absWorkingDir: root, entryPoints: [entry(configuration.notesEntry)],
    tsconfigRaw: { compilerOptions: {} }, outfile: resolve(root, "assets/editor/notes-rich.js"),
    bundle: true, format: "esm", platform: "browser", target: "chrome140", minify: true, legalComments: "eof", metafile: true });
  for (const name of Object.keys(result.metafile.outputs).map(name => name.replaceAll("\\", "/"))) {
    const data = await readFile(resolve(root, name));
    records.push({ path: name, bytes: data.length, sha256: digest(data) });
  }
  const catalog = JSON.parse(await readFile(resolve(root, "assets/client-routes.json"), "utf8"));
  const routes = [];
  for (const route of catalog) {
    if (await stat(resolve(root, route === "/" ? "index.html" : route.slice(1))).then(file => file.isFile(), () => false)) routes.push(route);
  }
  await writeFile(resolve(root, "assets/client-routes.json"), JSON.stringify(routes, null, 2) + "\n");
  for (const [folder, files] of [["gaze", ["gaze-math.js", "gaze-worker.js"]], ["editor", ["notes-rich.js", "LICENSES.txt"]]]) {
    const filename = resolve(root, `assets/${folder}/PROVENANCE.json`);
    const provenance = JSON.parse(await readFile(filename, "utf8"));
    for (const name of files) {
      const item = provenance.files.find(file => file.path === name);
      if (!item) throw Error(`Missing reviewed generated asset provenance: ${folder}/${name}`);
      const data = await readFile(resolve(root, `assets/${folder}/${name}`));
      item.bytes = data.length;
      item.sha256 = digest(data);
    }
    await writeFile(filename, JSON.stringify(provenance, null, 2) + "\n");
  }
  await writeFile(resolve(root, "assets/build-manifest.json"), JSON.stringify({ schema: 1,
    edition: configuration.edition, files: records.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2) + "\n");
  await productProvenance(root, configuration, { client: result, native, notes, audioResources });
}
