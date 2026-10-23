import type { Database } from "bun:sqlite";
import { foldSearch } from "../../search/fold.ts";

export function backfillSearch(client: Database) {
  let after = "";
  while (true) {
    const rows = client
      .query<{ id: string; title: string }, [string]>(
        "SELECT id,title FROM next_conversations WHERE id>? ORDER BY id LIMIT 100",
      )
      .all(after);
    for (const row of rows)
      client
        .query("UPDATE next_conversations SET search_title=? WHERE id=?")
        .run(foldSearch(row.title), row.id);
    if (rows.length < 100) break;
    after = rows.at(-1)!.id;
  }
  let position = 0;
  while (true) {
    const rows = client
      .query<{ position: number; data: string }, [number]>(
        "SELECT position,data FROM next_history WHERE position>? ORDER BY position LIMIT 100",
      )
      .all(position);
    for (const row of rows) {
      const value: unknown = JSON.parse(row.data);
      const text =
        value &&
        typeof value === "object" &&
        "text" in value &&
        typeof value.text === "string"
          ? value.text
          : "";
      client
        .query("UPDATE next_history SET search_text=? WHERE position=?")
        .run(foldSearch(text), row.position);
    }
    if (rows.length < 100) break;
    position = rows.at(-1)!.position;
  }
}
