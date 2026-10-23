import { expect, test } from "bun:test";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runtimeReleaseFixture } from "../support/runtime-release.ts";
import { loadRuntimeRelease } from "../../packages/desktop/release-loader.ts";
import {
  runtimeClient,
  runtimeSources,
} from "../../packages/desktop/release.ts";
import { fileDigest } from "../../packages/desktop/release-files.ts";

test("native resource loading checks platform and every declared source/client digest before returning launch paths", async () => {
  const fixture = await runtimeReleaseFixture(),
    signal = new AbortController().signal;
  try {
    const loaded = await loadRuntimeRelease(
      fixture.directory,
      signal,
      fixture.host,
    );
    expect(loaded.entrypoint).toBe(
      join(loaded.directory, "apps/desktop/server.ts"),
    );
    expect(loaded.clientDirectory).toBe(join(loaded.root, "client"));
    await expect(
      loadRuntimeRelease(fixture.directory, signal, {
        platform: "linux",
        architecture: "x64",
      }),
    ).rejects.toThrow("platform");
    await fixture.put("backend/apps/desktop/server.ts", "changed-source");
    await expect(
      loadRuntimeRelease(fixture.directory, signal, fixture.host),
    ).rejects.toThrow("integrity");
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("a changed client manifest, missing public catalog resource or aborted loading cannot be accepted", async () => {
  const fixture = await runtimeReleaseFixture(),
    signal = new AbortController().signal;
  try {
    const filename = join(fixture.directory, "client/client-manifest.json");
    const manifest = runtimeClient.parse(
      JSON.parse(await readFile(filename, "utf8")),
    );
    manifest.files = manifest.files.filter(
      (file) => file.path !== "assets/geist.woff2",
    );
    const text = JSON.stringify(manifest);
    await fixture.put("client/client-manifest.json", text);
    await expect(
      loadRuntimeRelease(fixture.directory, signal, fixture.host),
    ).rejects.toThrow("manifest integrity");
    await fixture.put(
      "backend-release.json",
      JSON.stringify({
        ...fixture.release,
        clientManifestSha256: fileDigest(Buffer.from(text)),
      }),
    );
    await expect(
      loadRuntimeRelease(fixture.directory, signal, fixture.host),
    ).rejects.toThrow("unverified file");
    const abort = new AbortController();
    abort.abort();
    await expect(
      loadRuntimeRelease("not-a-real-directory", abort.signal, fixture.host),
    ).rejects.toHaveProperty("name", "AbortError");
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("native manifests refuse traversal, hidden configuration and source paths outside maintained runtime modules", () => {
  const entry = { sha256: "0".repeat(64) };
  for (const path of [
    "../private.json",
    "/private.json",
    "assets/../private.json",
    ".env",
    "backend/.env",
    "data/store.sqlite",
  ])
    expect(
      runtimeSources.safeParse({
        format: "cadence-native-sources/1",
        files: [{ ...entry, path }],
      }).success,
    ).toBe(false);
  for (const path of [
    ".env",
    "node_modules/../.env",
    "/absolute",
    "C:/private",
    "private\\file",
  ])
    expect(
      runtimeClient.safeParse({
        format: "cadence-client/1",
        files: [{ ...entry, path, bytes: 1 }],
      }).success,
    ).toBe(false);
});

test("native source manifests admit only bounded reviewed audio helper source locations", () => {
  const manifest = (path: string) => ({ format: "cadence-native-sources/1",
    files: [{ path, sha256: "0".repeat(64) }] });
  for (const path of ["packages/desktop/system-audio/helper.ps1",
    "packages/desktop/system-audio/wasapi-capture.cs"])
    expect(runtimeSources.safeParse(manifest(path)).success).toBe(true);
  for (const path of ["scripts/helper.ps1", "apps/helper.cs", "packages/other/helper.ps1",
    "packages/desktop/system-audio/nested/helper.ps1", "packages/desktop/system-audio/.hidden.cs",
    "packages/desktop/system-audio/../helper.ps1", "packages/desktop/system-audio/helper.exe"])
    expect(runtimeSources.safeParse(manifest(path)).success).toBe(false);
});
