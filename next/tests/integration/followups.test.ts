import { afterAll } from "bun:test";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteFollowups } from "../../packages/storage/sqlite/followups.ts";
import { sqliteFollowupOutbox } from "../../packages/storage/sqlite/followup-outbox.ts";
import { followupCases } from "../support/followup-cases.ts";
const connections: ReturnType<typeof sqliteConnection>[] = [];
afterAll(() => connections.forEach((connection) => connection.close()));
followupCases("SQLite follow-ups", async () => {
  const connection = sqliteConnection(":memory:");
  connections.push(connection);
  await migrateSqlite(connection);
  return {
    repository: new SqliteFollowups(connection),
    sessions: new SqliteSessions(connection),
    outbox: (cipher, clock) => sqliteFollowupOutbox(connection, cipher, clock),
  };
});
