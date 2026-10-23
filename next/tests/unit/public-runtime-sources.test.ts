import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packagePublicSources } from "../../packages/desktop/public-sources.ts";
import { fileDigest } from "../../packages/desktop/release-files.ts";
test("public runtime uses root manifest and lock without taking private trees or installed dependencies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-public-runtime-"));
  const source = join(directory, "source"), target = join(directory, "target");
  try {
    for (const path of ["next/apps/desktop", "next/packages/synthetic", "next/db/sqlite", "next/db/postgres", "node_modules/private", "target"])
      await mkdir(join(source, path), { recursive: true });
    await mkdir(target);
    await writeFile(join(source, "package.json"), JSON.stringify({ name: "@orvunia/core", version: "0.2.0" }));
    await writeFile(join(source, "bun.lock"), "synthetic-lock");
    await writeFile(join(source, "next/apps/desktop/server.ts"), "export const synthetic = true;\n");
    await writeFile(join(source, "next/packages/synthetic/domain.ts"), "export type Synthetic = string;\n");
    await writeFile(join(source, "next/db/sqlite/0001-fixture.sql"), "CREATE TABLE fixture(id TEXT);\n");
    await writeFile(join(source, "next/db/postgres/private.sql"), "private-sentinel");
    await writeFile(join(source, "node_modules/private/private.ts"), "private-sentinel");
    const result = await packagePublicSources(source, target, new AbortController().signal);
    expect(result.manifest.files.map((file) => file.path)).toEqual([
      "apps/desktop/server.ts", "bun.lock", "db/sqlite/0001-fixture.sql", "package.json", "packages/synthetic/domain.ts",
    ]);
    expect(result.sha256).toBe(fileDigest(await readFile(join(target, "source-manifest.json"))));
    expect((await readFile(join(target, "bun.lock"), "utf8"))).toBe("synthetic-lock");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("mixed workspace cannot be packaged as the public product", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-public-runtime-rejected-"));
  try {
    await writeFile(join(directory, "package.json"), JSON.stringify({ name: "private-mixed-workspace" }));
    await expect(packagePublicSources(directory, join(directory, "unused"), new AbortController().signal))
      .rejects.toThrow("reviewed standalone core");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
