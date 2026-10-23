import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite, migrationFiles } from "../../packages/storage/migrations.ts";
import { benchmarkSchema } from "../../packages/local-models/benchmarks/schema.ts";

test("0021 adds benchmark storage to an existing 0020 database without changing prior data or migration hashes", async () => {
  const connection = sqliteConnection(":memory:");
  try {
    const files = await migrationFiles("sqlite");
    const benchmark = files.find(file => file.name === "0021-model-benchmarks.sql")!;
    expect(benchmark.sql.trim()).toBe(benchmarkSchema.trim());
    connection.client.exec("CREATE TABLE next_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)");
    for (const file of files.filter(file => file.name < benchmark.name)) {
      connection.client.exec(file.sql);
      connection.client.query("INSERT INTO next_migrations VALUES (?,?)").run(file.name, file.hash);
    }
    const installation = { id: randomUUID(), revision: 4, state: "installed", catalogId: "preserved",
      catalogRevision: "a".repeat(40), files: [] };
    connection.client.query("INSERT INTO next_model_installations VALUES (?,?,?,?)")
      .run(installation.id, installation.revision, installation.state, JSON.stringify(installation));
    const original = connection.client.query("SELECT * FROM next_model_installations").all();
    const ledger = connection.client.query("SELECT * FROM next_migrations ORDER BY name").all();
    await migrateSqlite(connection); await migrateSqlite(connection);
    expect(connection.client.query("SELECT * FROM next_model_installations").all()).toEqual(original);
    expect(connection.client.query("SELECT * FROM next_model_benchmarks").all()).toEqual([]);
    expect(connection.client.query("SELECT * FROM next_migrations WHERE name<? ORDER BY name").all(benchmark.name)).toEqual(ledger);
    expect(connection.client.query("SELECT hash FROM next_migrations WHERE name=?").get(benchmark.name)).toEqual({ hash: benchmark.hash });
  } finally { connection.close(); }
});
