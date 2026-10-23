import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteConversations } from "../../packages/storage/sqlite/conversations.ts";
import { conversations } from "../../packages/conversations/service.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
async function fixture(filename = ":memory:") {
  const connection = sqliteConnection(filename);
  await migrateSqlite(connection);
  const service = conversations(
    new SqliteConversations(connection),
    () => Bun.randomUUIDv7(),
    () => new Date(),
  );
  return { connection, service };
}
describe("SQLite conversation invariants", () => {
  test("migrations are repeatable and data survives reopening", async () => {
    const directory = mkdtempSync(join(tmpdir(), "cadence-next-"));
    directories.push(directory);
    const filename = join(directory, "test.sqlite");
    const first = await fixture(filename);
    const created = await first.service.create("owner", {
      title: "Persisted",
      mode: "technical",
    });
    await first.service.updateNotes("owner", created.id, {
      text: "Notes",
      revision: 0,
    });
    first.connection.close();
    const second = await fixture(filename);
    try {
      await migrateSqlite(second.connection);
      expect((await second.service.find("owner", created.id)).title).toBe(
        "Persisted",
      );
      expect((await second.service.notes("owner", created.id)).revision).toBe(
        1,
      );
    } finally {
      second.connection.close();
    }
  });
  test("another workspace cannot read, end or overwrite notes", async () => {
    const { connection, service } = await fixture();
    try {
      const created = await service.create("first", {
        title: "Private",
        mode: "recruiter",
      });
      expect(await service.list("second", 20)).toEqual([]);
      await expect(service.find("second", created.id)).rejects.toMatchObject({
        code: "conversation_not_found",
      });
      await expect(service.end("second", created.id)).rejects.toMatchObject({
        code: "conversation_not_found",
      });
      await expect(
        service.updateNotes("second", created.id, {
          text: "Attack",
          revision: 0,
        }),
      ).rejects.toMatchObject({ code: "conversation_not_found" });
      expect((await service.find("first", created.id)).state).toBe("active");
    } finally {
      connection.close();
    }
  });
  test("stale revisions conflict; repeating the same content is idempotent", async () => {
    const { connection, service } = await fixture();
    try {
      const created = await service.create("owner", {
        title: "Notes",
        mode: "technical",
      });
      const saved = await service.updateNotes("owner", created.id, {
        text: "First",
        revision: 0,
      });
      expect(
        await service.updateNotes("owner", created.id, {
          text: "First",
          revision: 0,
        }),
      ).toEqual(saved);
      await expect(
        service.updateNotes("owner", created.id, {
          text: "Stale",
          revision: 0,
        }),
      ).rejects.toMatchObject({ code: "notes_conflict", current: saved });
      expect((await service.notes("owner", created.id)).text).toBe("First");
    } finally {
      connection.close();
    }
  });
});
