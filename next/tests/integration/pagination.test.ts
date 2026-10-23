import { expect, test } from "bun:test";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { schemaReadiness } from "../../packages/storage/readiness.ts";
import { SqliteConversations } from "../../packages/storage/sqlite/conversations.ts";

test("pagination sorts by creation date even when legacy UUIDs sort in reverse", async () => {
  const connection = sqliteConnection(":memory:");
  await migrateSqlite(connection);
  try {
    const repository = new SqliteConversations(connection);
    const first = {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      workspaceId: "owner",
      title: "Older",
      mode: "technical" as const,
      state: "active" as const,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const second = {
      ...first,
      id: "00000000-0000-4000-8000-000000000001",
      title: "Newer",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await repository.insert(first);
    await repository.insert(second);
    expect((await repository.list("owner", 1))[0]?.id).toBe(second.id);
    expect((await repository.list("owner", 1, second.id))[0]?.id).toBe(
      first.id,
    );
    await expect(
      repository.list("another", 1, second.id),
    ).rejects.toMatchObject({ code: "conversation_not_found" });
  } finally {
    connection.close();
  }
});
test("readiness rejects missing migrations and changed checksums", async () => {
  const connection = sqliteConnection(":memory:");
  const ready = await schemaReadiness("sqlite");
  try {
    expect(ready([])).toBe(false);
    await migrateSqlite(connection);
    const applied = connection.client
      .query<{ name: string; hash: string }, []>(
        "SELECT name,hash FROM next_migrations",
      )
      .all();
    expect(ready(applied)).toBe(true);
    expect(ready(applied.map((row) => ({ ...row, hash: "changed" })))).toBe(
      false,
    );
  } finally {
    connection.close();
  }
});
