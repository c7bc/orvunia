import { and, eq } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Workspace } from "../../workspaces/domain.ts";
import type { WorkspaceRepository } from "../../workspaces/repository.ts";
import type { SqliteConnection } from "./connection.ts";

const workspaces = sqliteTable("next_workspaces", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  data: text("data", { mode: "json" }).$type<Workspace>().notNull(),
});

export class SqliteWorkspaces implements WorkspaceRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async find(id: string) {
    return (
      this.connection.database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .get()?.data ?? null
    );
  }
  async insert(workspace: Workspace) {
    return (
      this.connection.database
        .insert(workspaces)
        .values({
          id: workspace.id,
          revision: workspace.revision,
          data: workspace,
        })
        .onConflictDoNothing()
        .returning({ id: workspaces.id })
        .get() !== undefined
    );
  }
  async replace(workspace: Workspace, expectedRevision: number) {
    return (
      this.connection.database
        .update(workspaces)
        .set({
          revision: workspace.revision,
          data: workspace,
        })
        .where(
          and(
            eq(workspaces.id, workspace.id),
            eq(workspaces.revision, expectedRevision),
          ),
        )
        .returning({ id: workspaces.id })
        .get() !== undefined
    );
  }
}
