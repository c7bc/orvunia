import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { stageLegacyInstallation } from "../../packages/migration/installation.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { fileConnections } from "../../packages/providers/file.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteCalendar } from "../../packages/storage/sqlite/calendar.ts";
import { scopedCalendarVault } from "../../packages/calendar/scoped-vault.ts";

test("operating-system vault capability is required to open protected legacy connections and calendar purposes stay separate", async () => {
  const directory = await mkdtemp(
      join(tmpdir(), "cadence-installation-vault-"),
    ),
    source = join(directory, "legacy"),
    target = join(directory, "staged"),
    vault = fileVault(
      join(directory, "synthetic-os-key"),
      "synthetic-test-os-vault",
    ),
    fixture = await legacyInstallation(source, vault);
  try {
    expect(
      await stageLegacyInstallation(source, join(directory, "unavailable"), {
        quiesced: true,
      }).catch((error) => error),
    ).toMatchObject({
      message:
        "Legacy calendar authorization cannot be opened with the available vault",
    });
    const before = fixture.snapshot();
    const manifest = await stageLegacyInstallation(source, target, {
      quiesced: true,
      vault,
    });
    expect(fixture.snapshot()).toEqual(before);
    expect(manifest.unhandled).toEqual([]);
    expect(
      await fileConnections(join(target, "providers.next.json"), vault).read(),
    ).toEqual(fixture.connections);
    expect(
      await readFile(join(target, "providers.next.json"), "utf8"),
    ).not.toContain("synthetic-preserved-provider-secret");
    const connection = sqliteConnection(join(target, "cadence-next.sqlite"));
    try {
      const record = await new SqliteCalendar(connection).find(
        fixture.original.owner,
      );
      expect(
        JSON.parse(await scopedCalendarVault(vault).open(record!.tokens!)),
      ).toEqual(fixture.tokens);
      expect(
        await scopedCalendarVault(vault)
          .open(await readFile(join(target, "providers.next.json"), "utf8"))
          .catch((error) => error),
      ).toBeInstanceOf(Error);
    } finally {
      connection.close();
    }
  } finally {
    fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
