import { z } from "zod";
import type { LegacyReader } from "../migration/reader.ts";
import { migrationFiles } from "../storage/migrations.ts";
import { objectKey } from "../assets/keys.ts";
const integer = z.number().int().nonnegative();
export async function backupSchema(reader: LegacyReader, complete: boolean) {
  const applied = reader
      .rows("next_migrations")
      .map((row) =>
        z.object({ name: z.string(), hash: z.string() }).parse(row),
      ),
    expected = await migrationFiles("sqlite"),
    known = new Map(expected.map((value) => [value.name, value.hash]));
  if (
    !applied.length ||
    applied.some((value) => known.get(value.name) !== value.hash) ||
    (complete && applied.length !== expected.length)
  )
    throw Error("Personal backup schema is incompatible with this backend");
  return applied;
}
export function backupObjects(reader: LegacyReader, now: number) {
  const pins = new Set(
    reader
      .rows("next_asset_references")
      .filter((row) => Number(row.expires_at) > now)
      .map((row) => String(row.asset_id)),
  );
  return reader
    .rows("next_assets")
    .map((row) =>
      z
        .object({
          id: z.uuid(),
          object_key: z.string().transform(objectKey),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          bytes: integer.positive().max(64 * 1024 * 1024),
          state: z.enum(["staged", "ready", "deleting", "deleted"]),
        })
        .parse(row),
    )
    .filter(
      (value) =>
        value.state !== "deleted" &&
        (value.state !== "deleting" || pins.has(value.id)),
    )
    .map((value) => ({
      path: `objects/${value.object_key}`,
      hash: value.hash,
      bytes: value.bytes,
      required: value.state === "ready" || pins.has(value.id),
    }));
}
export function backupIdle(reader: LegacyReader) {
  if (
    reader
      .rows("next_operations")
      .some((row) => row.state === "running" || row.state === "prepared") ||
    reader
      .rows("next_followup_deliveries")
      .some((row) => row.state === "processing")
  )
    throw Error("Drain active work before creating a personal backup");
}
