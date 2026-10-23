import { SqliteSessionIndex } from "../../packages/storage/sqlite/session-index.ts";
import { afterAll } from "bun:test";
import { searchCases } from "../support/search-cases.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { workspaces } from "../../packages/workspaces/service.ts";

const connections: ReturnType<typeof sqliteConnection>[] = [];
afterAll(() => connections.forEach((connection) => connection.close()));
searchCases("SQLite", async () => {
  const connection = sqliteConnection(":memory:");
  connections.push(connection);
  await migrateSqlite(connection);
  return {
    indexRepository: new SqliteSessionIndex(connection),
    repository: new SqliteSessions(connection),
    workspace: workspaces(new SqliteWorkspaces(connection), () => new Date()),
  };
});
