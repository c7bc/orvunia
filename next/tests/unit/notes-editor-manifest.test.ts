import { expect, test } from "bun:test";
import { mkdtemp, mkdir, copyFile, appendFile, rm } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { verifyBuildManifest } from "../../packages/runtime/build-manifest.ts";
test("editor build provenance includes its type contracts and rejects a stale maintained input", async () => {
  const root = resolve(import.meta.dir, "../../..");
  const filename = "client/notes-rich/bundles.json";
  const format = "cadence-notes-editor-bundles/1";
  const manifest = z
    .object({
      sources: z.array(z.object({ path: z.string(), sha256: z.string() })),
      bundles: z.array(z.object({ path: z.string(), sha256: z.string() })),
    })
    .parse(await Bun.file(join(root, filename)).json());
  expect(
    manifest.sources.some(
      (source) => source.path === "client/notes-rich/contracts.ts",
    ),
  ).toBe(true);
  const directory = await mkdtemp(join(tmpdir(), "cadence-editor-manifest-"));
  try {
    for (const entry of [
      ...manifest.sources,
      ...manifest.bundles,
      { path: filename },
    ]) {
      await mkdir(dirname(join(directory, entry.path)), { recursive: true });
      await copyFile(join(root, entry.path), join(directory, entry.path));
    }
    expect(await verifyBuildManifest(directory, filename, format)).toEqual({
      sources: manifest.sources.length,
      bundles: manifest.bundles.length,
    });
    await appendFile(join(directory, "client/notes-rich/contracts.ts"), "\n");
    await expect(
      verifyBuildManifest(directory, filename, format),
    ).rejects.toThrow(
      "Generated artifact is stale: client/notes-rich/contracts.ts",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
