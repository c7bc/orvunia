import { expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { personalProfile } from "../../apps/personal/profile.ts";

test("desktop and application markers reject personal startup before creating any runtime files", async () => {
  const markers = [
    "desktop.json",
    "backend-active.json",
    "candidate-profile.json",
    "browser-storage-origin.json",
    "Local State",
    "Local Storage",
    "Session Storage",
    "Partitions",
    "package.json",
    "bun.lock",
    "pnpm-lock.yaml",
    "package-lock.json",
    "app.asar",
  ];
  for (const marker of markers) {
    const directory = await mkdtemp(join(tmpdir(), "cadence-personal-guard-"));
    const original = Buffer.from("Synthetic original " + marker);
    try {
      await writeFile(join(directory, marker), original);
      expect(() => personalProfile(directory)).toThrow(
        "Personal browser startup",
      );
      expect(await readdir(directory)).toEqual([marker]);
      expect(await readFile(join(directory, marker))).toEqual(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("a synthetic existing native identity remains unchanged and never receives a parallel browser database", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "cadence-personal-native-guard-"),
  );
  const identity = Buffer.from(
    JSON.stringify({
      format: "cadence-desktop-runtime/1",
      workspaceId: crypto.randomUUID(),
      token: "x".repeat(43),
    }),
  );
  const desktop = Buffer.from('{"uiLocale":"en"}');
  try {
    await writeFile(join(directory, "desktop.json"), desktop);
    await writeFile(join(directory, "runtime-profile.json"), identity);
    expect(() => personalProfile(directory)).toThrow("desktop profile");
    expect((await readdir(directory)).sort()).toEqual([
      "desktop.json",
      "runtime-profile.json",
    ]);
    expect(await readFile(join(directory, "runtime-profile.json"))).toEqual(
      identity,
    );
    expect(await readFile(join(directory, "desktop.json"))).toEqual(desktop);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
