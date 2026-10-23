import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareDesktopStorage } from "../../packages/migration/desktop.ts";
test("an incomplete legacy installation cannot silently discard its existing provider settings or initialize an unrelated workspace", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cadence-desktop-incomplete-"));
  try {
    await mkdir(join(profile, "data"));
    const original = "synthetic-private-provider-configuration";
    await writeFile(join(profile, "data/providers.json"), original);
    await expect(
      prepareDesktopStorage({
        profile,
        seed: crypto.randomUUID(),
        quiesced: true,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Incomplete desktop installation");
    expect(await readFile(join(profile, "data/providers.json"), "utf8")).toBe(
      original,
    );
    expect(await readdir(profile)).not.toContain("backend-active.json");
    expect(await readdir(join(profile, "backend-data"))).toEqual([]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
