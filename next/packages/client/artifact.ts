import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { clientCatalog } from "./catalog.ts";

const notices = [
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
  "assets/client-routes.json",
  "assets/licenses/Geist-OFL-1.1.txt",
  "assets/licenses/Heroicons-MIT.txt",
  "assets/licenses/PROVENANCE.json",
  "assets/gaze/LICENSE-MEDIAPIPE.txt",
  "assets/gaze/NOTICE.txt",
  "assets/gaze/README.txt",
  "assets/gaze/PROVENANCE.json",
  "node_modules/marked/LICENSE",
  "node_modules/dompurify/LICENSE",
  "node_modules/dompurify/LICENSE-MPL",
  "node_modules/@highlightjs/cdn-assets/LICENSE",
];

export async function clientArtifact(
  directory: string,
  vendorDirectory = directory,
) {
  const root = await realpath(resolve(directory));
  const vendors = await realpath(resolve(vendorDirectory));
  const catalog = await clientCatalog(root);
  const paths = [...new Set([...catalog.values(), ...notices])].sort();
  return Promise.all(
    paths.map(async (path) => {
      if (
        path.startsWith("/") ||
        path.includes("\\") ||
        path
          .split("/")
          .some((part) => !part || part === "." || part === "..") ||
        (!/\.(?:html|js|mjs|css|woff2|wasm|task|txt|json|png|svg)$/.test(path) &&
          !/(?:^|\/)LICENSE(?:-MPL)?$/.test(path))
      )
        throw Error("Invalid public client artifact path");
      const base = path.startsWith("node_modules/") ? vendors : root;
      const actual = await realpath(resolve(base, path));
      if (!actual.startsWith(base + sep) || !(await lstat(actual)).isFile())
        throw Error("Client artifact must contain files within its source");
      const data = await readFile(actual);
      return {
        path,
        data,
        bytes: data.byteLength,
        sha256: createHash("sha256").update(data).digest("hex"),
      };
    }),
  );
}
