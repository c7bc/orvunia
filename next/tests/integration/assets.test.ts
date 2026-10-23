import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assetCases } from "../support/asset-cases.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteAssets } from "../../packages/storage/sqlite/assets.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { filesystemObjects } from "../../packages/assets/filesystem.ts";

const connections: ReturnType<typeof sqliteConnection>[] = [],
  directories: string[] = [];
afterAll(() => {
  connections.forEach((connection) => connection.close());
  directories.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }),
  );
});
assetCases("SQLite/filesystem", async () => {
  const connection = sqliteConnection(":memory:");
  connections.push(connection);
  await migrateSqlite(connection);
  const directory = mkdtempSync(join(tmpdir(), "cadence-assets-"));
  directories.push(directory);
  return {
    repository: new SqliteAssets(connection),
    sessions: new SqliteSessions(connection),
    objects: await filesystemObjects(directory),
  };
});
