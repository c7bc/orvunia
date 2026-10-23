import { foldSearch } from "../search/fold.ts";
import { join } from "node:path";
import { sqliteConnection } from "../storage/sqlite/connection.ts";
import { migrateSqlite } from "../storage/migrations.ts";
import { conversations, notes } from "../storage/sqlite/schema.ts";
import { history } from "../storage/sqlite/history-schema.ts";
import { assets } from "../storage/sqlite/asset-schema.ts";
import { eq } from "drizzle-orm";
import { filesystemObjects } from "../assets/filesystem.ts";
import { prepareLegacyImport, recordImport } from "./staging.ts";
import { writeLocalSupplemental } from "./local-supplemental.ts";
import { writeLocalBilling } from "./local-billing.ts";
import { expansions } from "../storage/sqlite/expansion-schema.ts";
import {
  legacyUploads,
  legacySegments,
} from "../storage/sqlite/legacy-schema.ts";
import {
  operations,
  assetReferences,
} from "../storage/sqlite/operation-schema.ts";

export async function stageLegacyLocal(source: string, directory: string) {
  return writeLegacyLocal(await prepareLegacyImport(source, directory));
}
export async function writeLegacyLocal({
  projection,
  manifest,
  root,
}: Awaited<ReturnType<typeof prepareLegacyImport>>) {
  const objects = await filesystemObjects(join(root, "objects"));
  for (const image of projection.images)
    await objects.put(image.asset.objectKey, image.data, image.asset.mime);
  const connection = sqliteConnection(join(root, "cadence-next.sqlite"));
  try {
    await migrateSqlite(connection);
    connection.client
      .transaction(() => {
        for (const workspace of projection.workspaces)
          connection.client
            .query(
              "INSERT INTO next_workspaces(id,revision,data) VALUES(?,?,?)",
            )
            .run(workspace.id, workspace.revision, JSON.stringify(workspace));
        for (const session of projection.sessions) {
          connection.database
            .insert(conversations)
            .values({ ...session, searchTitle: foldSearch(session.title) })
            .run();
          connection.database
            .insert(notes)
            .values({ conversationId: session.id, text: "", revision: 0 })
            .run();
        }
        for (const entry of projection.entries)
          connection.database
            .insert(history)
            .values({
              ...entry,
              searchText:
                entry.kind === "captures" ? "" : foldSearch(entry.data.text),
            })
            .run();
        for (const image of projection.images)
          connection.database.insert(assets).values(image.asset).run();
        for (const item of projection.notes)
          connection.database
            .update(notes)
            .set(item.value)
            .where(eq(notes.conversationId, item.conversationId))
            .run();
        writeLocalSupplemental(connection, projection.supplemental);
        writeLocalBilling(connection, projection.billing);
        for (const receipt of projection.receipts.uploads)
          connection.database.insert(legacyUploads).values(receipt).run();
        for (const receipt of projection.receipts.segments)
          connection.database.insert(legacySegments).values(receipt).run();
        for (const operation of projection.operations) {
          connection.database.insert(operations).values(operation).run();
          for (const image of operation.snapshot?.images ?? [])
            connection.database
              .insert(assetReferences)
              .values({
                operationKind: operation.kind,
                operationId: operation.id,
                assetId: image.id,
                expiresAt: operation.expiresAt,
              })
              .run();
        }
        for (const stage of projection.expansions)
          connection.database.insert(expansions).values(stage).run();
        for (const calendar of projection.calendars)
          connection.client
            .query(
              "INSERT INTO next_calendars(workspace_id,revision,state_hash,data) VALUES(?,?,?,?)",
            )
            .run(
              calendar.workspaceId,
              calendar.revision,
              calendar.authorization?.hash ?? null,
              JSON.stringify(calendar),
            );
      })
      .immediate();
    await recordImport(root, manifest);
    return manifest;
  } finally {
    connection.close();
  }
}
