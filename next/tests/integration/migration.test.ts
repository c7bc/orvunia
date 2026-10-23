import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import { legacyFixture } from "../support/legacy-fixture.ts";
import { stageLegacyLocal } from "../../packages/migration/local.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { SqliteConversations } from "../../packages/storage/sqlite/conversations.ts";
import { SqliteAssets } from "../../packages/storage/sqlite/assets.ts";
import { filesystemObjects } from "../../packages/assets/filesystem.ts";

test("offline staging preserves legacy IDs, order, notes, modes, images and a complete private archive", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cadence-legacy-import-"));
  const source = join(directory, "cadence.sqlite"),
    target = join(directory, "staged");
  const legacy = legacyFixture(source),
    before = legacy.database.serialize();
  try {
    const manifest = await stageLegacyLocal(source, target);
    expect(legacy.database.serialize()).toEqual(before);
    expect(manifest.counts).toEqual({
      workspaces: 1,
      sessions: 1,
      entries: 4,
      images: 1,
      notes: 1,
    });
    expect(manifest.unhandled).toEqual([{ table: "answer_requests", rows: 1 }]);
    expect(manifest.cutoverAllowed).toBe(false);
    const snapshot = readFileSync(join(target, "legacy.snapshot.sqlite"));
    expect(createHash("sha256").update(snapshot).digest("hex")).toBe(
      manifest.sourceHash,
    );
    const archive = new Database(join(target, "legacy.snapshot.sqlite"), {
      readonly: true,
    });
    try {
      expect(
        archive.query("SELECT payload FROM answer_requests").get(),
      ).toEqual({ payload: "Synthetic immutable request context" });
    } finally {
      archive.close(true);
    }
    const connection = sqliteConnection(join(target, "cadence-next.sqlite"));
    try {
      const workspace = await new SqliteWorkspaces(connection).find(
        legacy.owner,
      );
      expect(workspace?.preferences).toEqual(legacy.preferences);
      expect(workspace?.library).toEqual(legacy.library);
      expect(workspace?.activeId).toBe(legacy.customId);
      const sessions = new SqliteSessions(connection);
      const session = await sessions.find(legacy.owner, legacy.session);
      expect(session?.elapsed).toBe(123);
      expect(session?.modeSnapshot?.id).toBe(legacy.customId);
      expect(session?.historyGeneration).toBe(3);
      const transcript = await sessions.entries(
        legacy.owner,
        legacy.session,
        "transcripts",
        { limit: 100 },
      );
      expect(transcript.map((entry) => entry.data.text)).toEqual([
        "Primeira fala",
        "Segunda fala",
      ]);
      expect(transcript[0]?.id).toBe(legacy.transcript);
      const notes = await new SqliteConversations(connection).notes(
        legacy.owner,
        legacy.session,
      );
      expect(notes.text).toBe("Notas pessoais");
      expect(notes.revision).toBe(7);
      const image = await new SqliteAssets(connection).find(
        legacy.owner,
        legacy.session,
        legacy.response,
      );
      expect(image?.state).toBe("ready");
      if (!image) throw Error("Imported image is missing");
      expect(
        await (
          await filesystemObjects(join(target, "objects"))
        ).get(image.objectKey, image.bytes),
      ).toEqual(legacy.image);
    } finally {
      connection.close();
    }
    await expect(stageLegacyLocal(source, target)).rejects.toBeDefined();
  } finally {
    legacy.database.close(true);
    rmSync(directory, { recursive: true, force: true });
  }
});
