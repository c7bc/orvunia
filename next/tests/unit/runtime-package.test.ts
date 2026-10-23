import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runtimeDestination } from "../../packages/desktop/package-destination.ts";

test("runtime staging cannot overlap source or replace an existing directory, and cleanup removes only its newly owned artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-runtime-package-")),
    source = join(root, "source"),
    existing = join(root, "existing");
  await mkdir(source);
  await mkdir(existing);
  await writeFile(join(source, "private.sqlite"), "preserve original data");
  await writeFile(join(existing, "keep.txt"), "preserve existing artifact");
  try {
    await expect(
      runtimeDestination(source, join(source, "nested")),
    ).rejects.toThrow("outside");
    await expect(runtimeDestination(source, root)).rejects.toThrow("outside");
    await expect(runtimeDestination(source, existing)).rejects.toThrow();
    const output = await runtimeDestination(source, join(root, "new-artifact"));
    await writeFile(join(output.target, "partial.txt"), "new temporary build");
    await output.discard();
    await expect(readdir(output.target)).rejects.toThrow();
    expect(await readFile(join(source, "private.sqlite"), "utf8")).toBe(
      "preserve original data",
    );
    expect(await readFile(join(existing, "keep.txt"), "utf8")).toBe(
      "preserve existing artifact",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime cleanup refuses to delete a destination whose build ownership marker changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-runtime-ownership-")),
    source = join(root, "source");
  await mkdir(source);
  try {
    const output = await runtimeDestination(source, join(root, "artifact"));
    await writeFile(join(output.target, "keep.txt"), "replacement data");
    await writeFile(
      join(output.target, ".package-owner"),
      "different-build-owner",
    );
    await expect(output.discard()).rejects.toThrow("no longer owned");
    expect(await readFile(join(output.target, "keep.txt"), "utf8")).toBe(
      "replacement data",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
