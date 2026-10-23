import { and, eq, inArray, sql } from "drizzle-orm";
import type { Asset } from "../../assets/domain.ts";
import { AssetError } from "../../assets/domain.ts";
import { assertUploadSession, repeatedUpload } from "../../assets/decisions.ts";
import type { AssetRepository } from "../../assets/repository.ts";
import { publicCapture } from "../../assets/service.ts";
import type { SqliteConnection } from "./connection.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";
import { assets } from "./asset-schema.ts";
import { assetCleanup } from "./asset-cleanup.ts";
import { legacyUpload } from "./legacy-read.ts";

export class SqliteAssets implements AssetRepository {
  legacyUpload: AssetRepository["legacyUpload"] = (...args) =>
    legacyUpload(this.connection, ...args);
  private readonly cleanup;
  constructor(private readonly connection: SqliteConnection) {
    this.cleanup = assetCleanup(connection);
  }
  garbage: AssetRepository["garbage"] = (...args) =>
    this.cleanup.garbage(...args);
  deleted: AssetRepository["deleted"] = (...args) =>
    this.cleanup.deleted(...args);
  async stage(asset: Asset, maximumBytes: number) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const workspaceId = asset.workspaceId,
          conversationId = asset.conversationId;

        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.workspaceId, workspaceId),
            ),
          )
          .get();
        assertUploadSession(session);
        const existing = database
          .select()
          .from(assets)
          .where(
            and(
              eq(assets.workspaceId, asset.workspaceId),
              eq(assets.requestKey, asset.requestKey),
            ),
          )
          .get();
        if (existing) return repeatedUpload(existing, asset);
        const usage = database
          .select({ bytes: sql<number>`coalesce(sum(${assets.bytes}), 0)` })
          .from(assets)
          .where(
            and(
              eq(assets.workspaceId, asset.workspaceId),
              inArray(assets.state, ["staged", "ready"]),
            ),
          )
          .get();
        if (Number(usage?.bytes ?? 0) + asset.bytes > maximumBytes)
          throw new AssetError("asset_limit");
        database.insert(assets).values(asset).run();
        return asset;
      })
      .immediate();
  }
  async complete(workspaceId: string, id: string) {
    const initial = this.connection.database
      .select()
      .from(assets)
      .where(and(eq(assets.workspaceId, workspaceId), eq(assets.id, id)))
      .get();
    if (!initial) throw new AssetError("asset_not_found");
    const conversationId = initial.conversationId;
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.workspaceId, workspaceId),
            ),
          )
          .get();
        assertUploadSession(session);
        const current = database
          .select()
          .from(assets)
          .where(and(eq(assets.workspaceId, workspaceId), eq(assets.id, id)))
          .get();
        if (!current || !["staged", "ready"].includes(current.state))
          throw new AssetError("asset_not_found");
        if (current.state === "ready") return current;
        const ready: Asset = { ...current, state: "ready" };
        database
          .update(assets)
          .set({ state: "ready" })
          .where(eq(assets.id, id))
          .run();
        database
          .insert(history)
          .values({
            id,
            conversationId,
            kind: "captures",
            segmentId: null,
            data: publicCapture(ready),
          })
          .run();
        return ready;
      })
      .immediate();
  }
  async find(workspaceId: string, conversationId: string, id: string) {
    const rows = this.connection.database
      .select({ asset: assets })
      .from(assets)
      .innerJoin(conversations, eq(assets.conversationId, conversations.id))
      .where(
        and(
          eq(assets.workspaceId, workspaceId),
          eq(conversations.workspaceId, workspaceId),
          eq(assets.conversationId, conversationId),
          eq(assets.id, id),
        ),
      )
      .get();
    return rows?.asset ?? null;
  }
  async remove(workspaceId: string, conversationId: string, id: string) {
    this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.workspaceId, workspaceId),
            ),
          )
          .get();
        assertUploadSession(session);
        const current = database
          .select()
          .from(assets)
          .where(and(eq(assets.workspaceId, workspaceId), eq(assets.id, id)))
          .get();
        if (
          !current ||
          current.conversationId !== conversationId ||
          ["deleting", "deleted"].includes(current.state)
        )
          return;
        database
          .update(assets)
          .set({ state: "deleting" })
          .where(eq(assets.id, id))
          .run();
        database
          .delete(history)
          .where(
            and(eq(history.id, id), eq(history.conversationId, conversationId)),
          )
          .run();
        database
          .update(conversations)
          .set({
            historyGeneration: sql`${conversations.historyGeneration} + 1`,
          })
          .where(eq(conversations.id, conversationId))
          .run();
      })
      .immediate();
  }
}
