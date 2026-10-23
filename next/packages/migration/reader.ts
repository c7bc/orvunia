import { Database } from "bun:sqlite";
import { lstat, readFile, open } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export type LegacyRow = Record<string, unknown>;
const identifier = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    throw Error("Invalid legacy table name");
  return `"${name}"`;
};
export async function legacyReader(filename: string) {
  const path = resolve(filename),
    stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024 * 1024)
    throw Error("Legacy source must be a regular SQLite file up to 512 MiB");
  const source = new Database(path, { readonly: true, strict: true });
  let snapshot: Buffer;
  try {
    source.exec("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN;");
    const health = source
      .query<{ quick_check: string }, []>("PRAGMA quick_check")
      .get();
    if (health?.quick_check !== "ok")
      throw Error("Legacy database integrity check failed");
    if (source.query("PRAGMA foreign_key_check").get())
      throw Error("Legacy database contains inconsistent foreign keys");
    snapshot = Buffer.from(source.serialize());
    source.exec("COMMIT");
  } finally {
    source.close(true);
  }
  if (snapshot.byteLength > 512 * 1024 * 1024)
    throw Error("Legacy snapshot exceeds 512 MiB");
  // SQLite deserialize requires a rollback-mode header; only the snapshot changes.
  // https://www.sqlite.org/c3ref/deserialize.html
  snapshot[18] = 1;
  snapshot[19] = 1;
  const database = Database.deserialize(snapshot, {
    readonly: true,
    strict: true,
  });
  const tables = new Set(
    database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((row) => row.name),
  );
  const rows = (name: string): LegacyRow[] =>
    tables.has(name)
      ? database
          .query<LegacyRow, []>(
            `SELECT * FROM ${identifier(name)} ORDER BY rowid`,
          )
          .all()
      : [];
  return {
    rows,
    tables,
    columns: (name: string) =>
      new Set(
        tables.has(name)
          ? database
              .query<{ name: string }, []>(
                `PRAGMA table_info(${identifier(name)})`,
              )
              .all()
              .map((column) => column.name)
          : [],
      ),
    count: (name: string) =>
      tables.has(name)
        ? Number(
            database
              .query<{ count: number }, []>(
                `SELECT count(*) AS count FROM ${identifier(name)}`,
              )
              .get()?.count ?? 0,
          )
        : 0,
    hash: createHash("sha256").update(snapshot).digest("hex"),
    async archive(destination: string) {
      const handle = await open(destination, "wx", 0o600);
      try {
        await handle.writeFile(snapshot);
        await handle.sync();
      } finally {
        await handle.close();
      }
      const bytes = await readFile(destination);
      if (
        !createHash("sha256")
          .update(bytes)
          .digest()
          .equals(createHash("sha256").update(snapshot).digest())
      )
        throw Error("Legacy archive checksum mismatch");
    },
    close: () => database.close(true),
  };
}
export type LegacyReader = Awaited<ReturnType<typeof legacyReader>>;
