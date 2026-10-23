import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

export async function readMigrationFiles(directory: URL) {
  const filenames = (await readdir(directory))
    .filter((name) => /^\d{4}-[a-z-]+\.sql$/.test(name)).sort();
  return Promise.all(filenames.map(async (name) => {
    const sql = await readFile(new URL(name, directory), "utf8");
    return { name, sql, hash: createHash("sha256").update(sql).digest("hex") };
  }));
}
