import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { prepareDesktopStorage } from "../../packages/migration/desktop.ts";
import { desktopWorkspace } from "../../packages/migration/desktop-workspace.ts";
import {
  publishDesktopPointer,
  readDesktopPointer,
} from "../../packages/migration/desktop-pointer.ts";

test("workspace selection preserves ownership and refuses ambiguous or stale cookies", () => {
  const first = crypto.randomUUID(),
    second = crypto.randomUUID(),
    seed = crypto.randomUUID();
  expect(desktopWorkspace([], seed)).toBe(seed);
  expect(desktopWorkspace([first], seed)).toBe(first);
  expect(desktopWorkspace([first, second], seed, second)).toBe(second);
  expect(() => desktopWorkspace([first, second], seed)).toThrow(
    "Select the existing workspace",
  );
  expect(() => desktopWorkspace([first], seed, second)).toThrow("unavailable");
});

test("interrupted imports and unknown records never publish an active pointer or replace original data", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cadence-desktop-interrupted-"));
  const fixture = await legacyInstallation(join(profile, "data"));
  const options = {
    profile,
    seed: crypto.randomUUID(),
    quiesced: true,
    signal: new AbortController().signal,
  };
  try {
    await expect(
      prepareDesktopStorage({ ...options, quiesced: false }),
    ).rejects.toThrow("stopped legacy writes");
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareDesktopStorage({ ...options, signal: controller.signal }),
    ).rejects.toThrow();
    expect(await readdir(profile)).toEqual(["data"]);
    fixture.original.database.exec(
      "CREATE TABLE unknown_payload(value TEXT); INSERT INTO unknown_payload VALUES('preserve')",
    );
    const before = fixture.snapshot();
    await expect(prepareDesktopStorage(options)).rejects.toThrow(
      "Unknown legacy data",
    );
    expect(await readDesktopPointer(profile)).toBeNull();
    expect(fixture.snapshot()).toEqual(before);
    const failed = await readdir(join(profile, "backend-data"));
    expect(failed).toHaveLength(1);
    fixture.original.database.exec("DROP TABLE unknown_payload");
    const recovered = await prepareDesktopStorage(options);
    expect(await readdir(join(profile, "backend-data"))).toHaveLength(2);
    expect(recovered.directory).not.toContain(failed[0]!);
    expect(recovered.workspaceId).toBe(fixture.original.owner);
  } finally {
    fixture.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("exclusive activation cannot replace another launch and corrupt metadata fails closed", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cadence-desktop-pointer-"));
  const pointer = {
    format: "cadence-desktop-storage/1" as const,
    directory: crypto.randomUUID(),
    workspaceId: crypto.randomUUID(),
  };
  try {
    const results = await Promise.allSettled([
      publishDesktopPointer(profile, pointer),
      publishDesktopPointer(profile, {
        ...pointer,
        directory: crypto.randomUUID(),
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const winner = await readDesktopPointer(profile);
    await expect(publishDesktopPointer(profile, pointer)).rejects.toThrow();
    expect(await readDesktopPointer(profile)).toEqual(winner);
    expect(await readdir(profile)).toEqual(["backend-active.json"]);
    await writeFile(
      join(profile, "backend-active.json"),
      '{"directory":"../../other"}',
    );
    const options = {
      profile,
      seed: crypto.randomUUID(),
      quiesced: true,
      signal: new AbortController().signal,
    };
    await expect(prepareDesktopStorage(options)).rejects.toThrow(
      "activation metadata is invalid",
    );
    expect(await readdir(profile)).toEqual(["backend-active.json"]);
    expect(
      await readFile(join(profile, "backend-active.json"), "utf8"),
    ).toContain("../../other");
    await mkdir(join(profile, "unrelated"));
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
