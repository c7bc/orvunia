import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { legacyFixture } from "../support/legacy-fixture.ts";
import { legacyReader } from "../../packages/migration/reader.ts";
import { projectWorkspaces } from "../../packages/migration/workspaces.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";

test("legacy importer leaves overwritten defaults unmarked so visible system prompts migrate on first persisted read", async () => {
  const directory = resolve(import.meta.dirname, "../../../work/workspace-prompt-tests", crypto.randomUUID());
  mkdirSync(directory, { recursive: true });
  const source = legacyFixture(resolve(directory, "legacy.sqlite"));
  const connection = sqliteConnection(":memory:");
  const now = "2026-10-20T00:00:00.000Z";
  try {
    const original = source.database.serialize();
    const reader = await legacyReader(resolve(directory, "legacy.sqlite"));
    let imported;
    try { imported = projectWorkspaces(reader, now)[0]; }
    finally { reader.close(); }
    if (!imported) throw Error("Missing projected workspace");
    expect(imported.systemPromptVersion).toBeUndefined();
    expect(imported.preferences).toEqual(source.preferences);
    expect(imported.modes.find(mode => mode.id === source.customId)?.instructions).toBe("Original prompt");
    await migrateSqlite(connection);
    const repository = new SqliteWorkspaces(connection);
    await repository.insert(imported);
    const service = workspaces(repository, () => new Date(now));
    const migrated = await service.find(imported.id);
    const mode = migrated.modes.find(value => value.id === source.customId);
    expect(migrated.systemPromptVersion).toBe(3);
    expect(migrated.activeId).toBe(source.customId);
    expect(mode?.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(mode?.instructions).toContain("Original prompt");
    expect(mode?.instructions).toContain("Shared prompt");
    expect(mode?.instructions).toContain("Technical prompt");
    expect(migrated.library).toEqual(source.library);
    expect(await service.find(imported.id)).toEqual(migrated);
    expect(source.database.serialize()).toEqual(original);
  } finally {
    connection.close();
    source.database.close(true);
  }
});
