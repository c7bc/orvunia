import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.ts";

export function sqliteConnection(filename: string) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const client = new Database(filename, { create: true, strict: true });
  client.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  return {
    client,
    database: drizzle(client, { schema }),
    close: () => client.close(true),
  };
}
export type SqliteConnection = ReturnType<typeof sqliteConnection>;
