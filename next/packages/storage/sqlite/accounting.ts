import { and, eq, lte } from "drizzle-orm";
import type { AccountingRepository } from "../../accounting/repository.ts";
import { reserveLocal } from "../../accounting/decisions.ts";
import type { SqliteConnection } from "./connection.ts";
import { usage } from "./usage-schema.ts";
import { usageSettlements } from "./settlement-schema.ts";
import { change } from "./usage-change.ts";

export class SqliteAccounting implements AccountingRepository {
  constructor(private readonly connection: SqliteConnection) {}
  reserve: AccountingRepository["reserve"] = async (candidate) =>
    this.connection.client.transaction(() => {
      const database = this.connection.database;
      const existing = database.select().from(usage).where(and(
        eq(usage.workspaceId, candidate.workspaceId),
        eq(usage.requestKey, candidate.requestKey),
        eq(usage.kind, candidate.kind),
      )).get() ?? null;
      const next = reserveLocal(candidate, existing);
      if (existing) database.update(usage).set(next).where(eq(usage.id, existing.id)).run();
      else database.insert(usage).values(next).run();
      return next;
    }).immediate();
  change: AccountingRepository["change"] = (...args) => change(this.connection, ...args);
  async settlements(limit: number) {
    return this.connection.database.select().from(usageSettlements).limit(limit).all();
  }
  async acknowledge(id: string) {
    this.connection.database.delete(usageSettlements)
      .where(eq(usageSettlements.reservationId, id)).run();
  }
  async markExpiredUnknown(now: number) {
    this.connection.database.update(usage).set({ state: "unknown" })
      .where(and(eq(usage.state, "reserved"), lte(usage.leaseUntil, now))).run();
  }
}
