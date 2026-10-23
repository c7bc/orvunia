import { join } from "node:path";
import { legacyReader } from "./reader.ts";
import { backupSchema, backupObjects } from "../backup/snapshot.ts";
import { privateBytes, digest } from "../backup/files.ts";
import type { ImportManifest } from "./projection.ts";
export async function verifyDesktopStorage(
  directory: string,
  manifest?: ImportManifest,
) {
  const reader = await legacyReader(join(directory, "cadence-next.sqlite"));
  try {
    await backupSchema(reader, false);
    if (manifest) {
      if (manifest.unhandled.length)
        throw Error("Unknown legacy data prevents desktop activation");
      const expected = [
        ["next_workspaces", manifest.counts.workspaces],
        ["next_conversations", manifest.counts.sessions],
        ["next_history", manifest.counts.entries],
        ["next_assets", manifest.counts.images],
      ] as const;
      for (const [table, count] of expected)
        if (reader.count(table) !== count)
          throw Error("Desktop import record verification failed");
      for (const object of backupObjects(reader, Date.now())) {
        if (!object.required) continue;
        const bytes = await privateBytes(directory, object.path);
        if (bytes.length !== object.bytes || digest(bytes) !== object.hash)
          throw Error("Desktop import image verification failed");
      }
    }
  } finally {
    reader.close();
  }
}
