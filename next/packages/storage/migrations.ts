import { backfillSearch } from "./sqlite/search-backfill.ts";
import { readMigrationFiles } from "./migration-files.ts";
import type { SqliteConnection } from "./sqlite/connection.ts";

export async function migrationFiles(_dialect: "sqlite") {
  return readMigrationFiles(new URL("../../db/sqlite/", import.meta.url));
}
export async function migrateSqlite(connection: SqliteConnection) {
  const { client } = connection;
  client.exec(
    "CREATE TABLE IF NOT EXISTS next_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)",
  );
  for (const file of await migrationFiles("sqlite")) {
    client
      .transaction(() => {
        const applied = client
          .query<{ hash: string }, [string]>(
            "SELECT hash FROM next_migrations WHERE name=?",
          )
          .get(file.name);
        if (applied && applied.hash !== file.hash)
          throw Error(`Migration changed: ${file.name}`);
        if (applied) return;
        client.exec(file.sql);
        if (file.name === "0009-search.sql") backfillSearch(client);
        client
          .query("INSERT INTO next_migrations(name,hash) VALUES(?,?)")
          .run(file.name, file.hash);
      })
      .immediate();
  }
}
