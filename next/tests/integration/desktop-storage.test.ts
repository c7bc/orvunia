import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { prepareDesktopStorage } from "../../packages/migration/desktop.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { fileConnections } from "../../packages/providers/file.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { SqliteCalendar } from "../../packages/storage/sqlite/calendar.ts";
import { scopedCalendarVault } from "../../packages/calendar/scoped-vault.ts";

test("desktop activation preserves the selected workspace, native vault, auxiliary data and later writes without reading the legacy database again", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cadence-desktop-storage-"));
  const vault = fileVault(join(profile, "synthetic-native.key"));
  const fixture = await legacyInstallation(join(profile, "data"), vault);
  const options = {
    profile,
    seed: crypto.randomUUID(),
    quiesced: true,
    vault,
    signal: new AbortController().signal,
  };
  let closed = false;
  try {
    const before = fixture.snapshot();
    const first = await prepareDesktopStorage(options);
    expect(first.imported).toBe(true);
    expect(first.workspaceId).toBe(fixture.original.owner);
    expect(fixture.snapshot()).toEqual(before);
    expect(
      await fileConnections(
        join(first.directory, "providers.next.json"),
        vault,
      ).read(),
    ).toEqual(fixture.connections);
    expect(
      await readFile(join(first.directory, "providers.next.json"), "utf8"),
    ).not.toContain("synthetic-preserved-provider-secret");
    const connection = sqliteConnection(
      join(first.directory, "cadence-next.sqlite"),
    );
    try {
      const workspace = await new SqliteWorkspaces(connection).find(
        first.workspaceId,
      );
      expect(workspace?.onboarding).toEqual(fixture.onboarding);
      expect(workspace?.preferences).toEqual(fixture.original.preferences);
      expect(workspace?.activeId).toBe(fixture.original.customId);
      const record = await new SqliteCalendar(connection).find(
        first.workspaceId,
      );
      expect(record?.events).toEqual([fixture.event]);
      expect(
        JSON.parse(await scopedCalendarVault(vault).open(record!.tokens!)),
      ).toEqual(fixture.tokens);
      expect(
        connection.client
          .query("SELECT text,revision FROM next_notes WHERE conversation_id=?")
          .get(fixture.original.session),
      ).toMatchObject({ text: "Notas pessoais", revision: 7 });
      connection.client
        .query("UPDATE next_conversations SET title=? WHERE id=?")
        .run("Written after migration", fixture.original.session);
    } finally {
      connection.close();
    }
    fixture.close();
    closed = true;
    await rename(join(profile, "data"), join(profile, "retained-original"));
    expect(
      await prepareDesktopStorage({ ...options, seed: crypto.randomUUID() }),
    ).toEqual(first);
    const restarted = sqliteConnection(
      join(first.directory, "cadence-next.sqlite"),
    );
    try {
      expect(
        restarted.client
          .query("SELECT title FROM next_conversations WHERE id=?")
          .get(fixture.original.session),
      ).toMatchObject({ title: "Written after migration" });
    } finally {
      restarted.close();
    }
    expect(await readdir(join(profile, "backend-data"))).toHaveLength(1);
  } finally {
    if (!closed) fixture.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("fresh desktop activation is persistent and cannot silently fall back after an incompatible database schema", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cadence-desktop-fresh-"));
  const options = {
    profile,
    seed: crypto.randomUUID(),
    quiesced: true,
    signal: new AbortController().signal,
  };
  try {
    const first = await prepareDesktopStorage(options);
    expect(first.workspaceId).toBe(options.seed);
    expect(first.imported).toBe(false);
    expect(await prepareDesktopStorage(options)).toEqual(first);
    const connection = sqliteConnection(
      join(first.directory, "cadence-next.sqlite"),
    );
    try {
      connection.client
        .query("INSERT INTO next_migrations(name,hash) VALUES(?,?)")
        .run("9999-unknown.sql", "f".repeat(64));
    } finally {
      connection.close();
    }
    await expect(prepareDesktopStorage(options)).rejects.toThrow(
      "schema is incompatible",
    );
    expect(await readdir(join(profile, "backend-data"))).toHaveLength(1);
    expect(
      JSON.parse(await readFile(join(profile, "backend-active.json"), "utf8"))
        .directory,
    ).toBe(first.directory.split(/[\\/]/).at(-1));
    await mkdir(join(profile, "data"));
    await expect(prepareDesktopStorage(options)).rejects.toThrow(
      "schema is incompatible",
    );
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});
