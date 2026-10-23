import { and, eq } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { CalendarRecord } from "../../calendar/domain.ts";
import type { CalendarRepository } from "../../calendar/repository.ts";
import type { SqliteConnection } from "./connection.ts";
const calendars = sqliteTable("next_calendars", {
  workspaceId: text("workspace_id").primaryKey(),
  revision: integer("revision").notNull(),
  stateHash: text("state_hash").unique(),
  data: text("data", { mode: "json" }).$type<CalendarRecord>().notNull(),
});
export class SqliteCalendar implements CalendarRepository {
  constructor(private readonly connection: SqliteConnection) {}
  async find(workspaceId: string) {
    return (
      this.connection.database
        .select()
        .from(calendars)
        .where(eq(calendars.workspaceId, workspaceId))
        .get()?.data ?? null
    );
  }
  async byState(hash: string) {
    return (
      this.connection.database
        .select()
        .from(calendars)
        .where(eq(calendars.stateHash, hash))
        .get()?.data ?? null
    );
  }
  async insert(record: CalendarRecord) {
    return (
      this.connection.database
        .insert(calendars)
        .values({
          workspaceId: record.workspaceId,
          revision: record.revision,
          stateHash: record.authorization?.hash ?? null,
          data: record,
        })
        .onConflictDoNothing()
        .returning({ id: calendars.workspaceId })
        .get() !== undefined
    );
  }
  async replace(record: CalendarRecord, expectedRevision: number) {
    return (
      this.connection.database
        .update(calendars)
        .set({
          revision: record.revision,
          stateHash: record.authorization?.hash ?? null,
          data: record,
        })
        .where(
          and(
            eq(calendars.workspaceId, record.workspaceId),
            eq(calendars.revision, expectedRevision),
          ),
        )
        .returning({ id: calendars.workspaceId })
        .get() !== undefined
    );
  }
}
