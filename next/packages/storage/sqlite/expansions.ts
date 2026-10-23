import { and, eq, inArray } from "drizzle-orm";
import type { ExpansionRepository } from "../../expansions/repository.ts";
import type { ExpansionStage } from "../../expansions/domain.ts";
import { ExpansionError } from "../../expansions/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { expansions } from "./expansion-schema.ts";
import { conversations } from "./schema.ts";
import { history } from "./history-schema.ts";
import { operations } from "./operation-schema.ts";
import { revealExpansion } from "./expansion-reveal.ts";
import { assertExpansionRequest } from "./expansion-request.ts";
const owned = (workspaceId: string, sourceId: string) =>
  and(
    eq(expansions.workspaceId, workspaceId),
    eq(expansions.sourceId, sourceId),
  );
export class SqliteExpansions implements ExpansionRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async find(workspaceId: string, conversationId: string, sourceId: string) {
    const database = this.connection.database;
    return (
      database
        .select()
        .from(expansions)
        .where(
          and(
            owned(workspaceId, sourceId),
            eq(expansions.conversationId, conversationId),
          ),
        )
        .get() ?? null
    );
  }
  async create(stage: ExpansionStage) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const session = database
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, stage.conversationId),
              eq(conversations.workspaceId, stage.workspaceId),
            ),
          )
          .get();
        if (!session) throw new OperationError("conversation_not_found");
        const source = database
          .select({ id: history.id })
          .from(history)
          .where(
            and(
              eq(history.id, stage.sourceId),
              eq(history.conversationId, stage.conversationId),
              eq(history.kind, "responses"),
            ),
          )
          .get();
        if (!source) throw new ExpansionError("response_not_found");
        assertExpansionRequest(database, stage);
        database.insert(expansions).values(stage).onConflictDoNothing().run();
        const saved = database
          .select()
          .from(expansions)
          .where(owned(stage.workspaceId, stage.sourceId))
          .get();
        if (!saved || saved.conversationId !== stage.conversationId)
          throw new OperationError("request_conflict");
        return saved;
      })
      .immediate();
  }
  async reset(workspaceId: string, sourceId: string, requestId: string) {
    const database = this.connection.database;
    database
      .update(expansions)
      .set({ cancelled: false })
      .where(
        and(owned(workspaceId, sourceId), eq(expansions.requestId, requestId)),
      )
      .run();
  }
  async cancel(workspaceId: string, sourceId: string, requestId: string) {
    return this.connection.client
      .transaction(() => {
        const database = this.connection.database;
        const stage = database
          .select()
          .from(expansions)
          .where(owned(workspaceId, sourceId))
          .get();
        if (!stage || stage.requestId !== requestId)
          throw new ExpansionError("expansion_not_found");
        const operation = database
          .select()
          .from(operations)
          .where(
            and(
              eq(operations.workspaceId, workspaceId),
              eq(operations.kind, "expansion"),
              eq(operations.id, requestId),
            ),
          )
          .get();
        if (operation && !["prepared", "running"].includes(operation.state))
          return;
        database
          .update(expansions)
          .set({ cancelled: true })
          .where(owned(workspaceId, sourceId))
          .run();
        database
          .update(operations)
          .set({ cancelRequested: true })
          .where(
            and(
              eq(operations.workspaceId, workspaceId),
              eq(operations.kind, "expansion"),
              eq(operations.id, requestId),
              inArray(operations.state, ["prepared", "running"]),
            ),
          )
          .run();
      })
      .immediate();
  }
  reveal: ExpansionRepository["reveal"] = (...args) =>
    revealExpansion(this.connection, ...args);
}
