import { expect, test } from "bun:test";
import {
  migrationFiles,
  migrateSqlite,
} from "../../packages/storage/migrations.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteSessionIndex } from "../../packages/storage/sqlite/session-index.ts";
import { sessionIndex } from "../../packages/search/service.ts";

test("SQLite search upgrade backfills existing titles and history inside the migration transaction", async () => {
  const connection = sqliteConnection(":memory:"),
    owner = crypto.randomUUID(),
    id = crypto.randomUUID();
  try {
    connection.client.exec(
      "CREATE TABLE next_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL)",
    );
    for (const file of await migrationFiles("sqlite")) {
      if (file.name >= "0009-search.sql") break;
      connection.client.exec(file.sql);
      connection.client
        .query("INSERT INTO next_migrations VALUES(?,?)")
        .run(file.name, file.hash);
    }
    connection.client
      .query(
        "INSERT INTO next_conversations(id,workspace_id,title,mode,state,created_at) VALUES(?,?,?,'technical','active',?)",
      )
      .run(id, owner, "Reunião anterior", "2026-10-15T12:00:00.000Z");
    connection.client
      .query(
        "INSERT INTO next_history(id,conversation_id,kind,data) VALUES(?,?,'transcripts',?)",
      )
      .run(
        crypto.randomUUID(),
        id,
        JSON.stringify({ text: "Comunicação anterior" }),
      );
    await migrateSqlite(connection);
    await migrateSqlite(connection);
    const index = sessionIndex(new SqliteSessionIndex(connection));
    for (const search of ["reuniao", "comunicacao"])
      expect(
        (await index.page(owner, { search, limit: 20 })).items.map(
          (item) => item.id,
        ),
      ).toEqual([id]);
    expect(
      connection.client
        .query("SELECT title FROM next_conversations WHERE id=?")
        .get(id),
    ).toEqual({ title: "Reunião anterior" });
  } finally {
    connection.close();
  }
});
