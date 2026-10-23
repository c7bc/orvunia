import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
const aliasFiles = {
  "/vendor/marked.js": "node_modules/marked/lib/marked.umd.js",
  "/vendor/purify.js": "node_modules/dompurify/dist/purify.min.js",
  "/vendor/highlight.js":
    "node_modules/@highlightjs/cdn-assets/highlight.min.js",
};
const gazeFiles = [
  "gaze-math.js",
  "gaze-worker.js",
  "vision_bundle.mjs",
  "face_landmarker.task",
  "wasm/vision_wasm_internal.js",
  "wasm/vision_wasm_internal.wasm",
  "wasm/vision_wasm_nosimd_internal.js",
  "wasm/vision_wasm_nosimd_internal.wasm",
];
export async function clientCatalog(root: string) {
  const paths = z
    .array(
      z
        .string()
        .regex(/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_./-]*)?$/)
        .refine((value) => !value.split("/").includes("..")),
    )
    .min(1)
    .parse(
      JSON.parse(
        await readFile(join(root, "assets/client-routes.json"), "utf8"),
      ),
    );
  const files = new Map(
    paths.map((path) => [path, path === "/" ? "index.html" : path.slice(1)]),
  );
  for (const [path, file] of Object.entries(aliasFiles)) files.set(path, file);
  for (const file of gazeFiles)
    files.set("/assets/gaze/" + file, "assets/gaze/" + file);
  files.set("/assets/geist.woff2", "assets/geist.woff2");
  return files;
}
