import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileDigest } from "../../packages/desktop/release-files.ts";
import { clientCatalog } from "../../packages/client/catalog.ts";
export async function runtimeReleaseFixture() {
  const directory = await mkdtemp(join(tmpdir(), "cadence-runtime-release-"));
  const source: Record<string, string> = {
    "apps/desktop/server.ts": "// synthetic runtime fixture",
    "package.json": '{"type":"module"}',
    "bun.lock": "synthetic-lock",
  };
  const put = async (path: string, text: string) => {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), text);
  };
  const sources = JSON.stringify({
    format: "cadence-native-sources/1",
    files: Object.entries(source).map(([path, text]) => ({
      path,
      sha256: fileDigest(Buffer.from(text)),
    })),
  });
  for (const [path, text] of Object.entries(source))
    await put("backend/" + path, text);
  await put("backend/source-manifest.json", sources);
  const catalog = '["/desktop.html","/desktop.js"]';
  await put("client/assets/client-routes.json", catalog);
  const files = [
    ...new Set([
      ...(await clientCatalog(join(directory, "client"))).values(),
      "assets/client-routes.json",
    ]),
  ];
  const clientEntries = [];
  for (const path of files) {
    const text =
      path === "assets/client-routes.json"
        ? catalog
        : "synthetic-public-resource";
    await put("client/" + path, text);
    clientEntries.push({
      path,
      bytes: Buffer.byteLength(text),
      sha256: fileDigest(Buffer.from(text)),
    });
  }
  const client = JSON.stringify({
    format: "cadence-client/1",
    files: clientEntries,
  });
  await put("client/client-manifest.json", client);
  const release = {
    format: "cadence-native-runtime/1" as const,
    version: "0.1.0",
    bunVersion: "1.4.3" as const,
    platform: "win32" as const,
    architecture: "x64" as const,
    executable: "bun.exe" as const,
    executableSha256: "0".repeat(64),
    sourceManifestSha256: fileDigest(Buffer.from(sources)),
    clientManifestSha256: fileDigest(Buffer.from(client)),
  };
  await put("backend-release.json", JSON.stringify(release));
  return {
    directory,
    release,
    put,
    host: { platform: "win32" as const, architecture: "x64" as const },
  };
}
