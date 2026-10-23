import { afterEach, expect, test } from "bun:test";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteAccounting } from "../../packages/storage/sqlite/accounting.ts";
import { localAccounting } from "../../packages/accounting/service.ts";
import { unmeasuredUsage } from "../../packages/accounting/domain.ts";

const connections: ReturnType<typeof sqliteConnection>[] = [];
afterEach(() => connections.splice(0).forEach((connection) => connection.close()));
async function fixture() {
  const connection = sqliteConnection(":memory:");
  connections.push(connection);
  await migrateSqlite(connection);
  let now = Date.UTC(2026, 9, 19);
  const repository = new SqliteAccounting(connection);
  return { connection, repository, advance: () => { now += 90_001; },
    service: localAccounting(repository, () => crypto.randomUUID(), () => now) };
}
test("local accounting is durable and idempotent without creating commercial accounts", async () => {
  const { service, connection } = await fixture();
  const first = await service.reserve("workspace", "answers", 1, "request");
  expect((await service.reserve("workspace", "answers", 1, "request")).id).toBe(first.id);
  await service.commit("workspace", first.id, 1, { ...unmeasuredUsage });
  expect((await service.reserve("workspace", "answers", 1, "request")).state).toBe("committed");
  expect(connection.client.query("SELECT count(*) AS total FROM next_billing_accounts").get()).toEqual({ total: 0 });
  await expect(service.reserve("workspace", "answers", 2, "request")).rejects.toThrow("reservation_conflict");
  await expect(service.commit("other", first.id, 1, { ...unmeasuredUsage })).rejects.toThrow("reservation_conflict");
});
test("expired reservations remain uncertain until explicit nonbillable recovery", async () => {
  const { service, advance } = await fixture();
  const first = await service.reserve("workspace", "transcriptionSeconds", 5, "audio");
  advance();
  await expect(service.reserve("workspace", "transcriptionSeconds", 5, "audio")).rejects.toThrow("reservation_unknown");
  await expect(service.release("workspace", first.id)).rejects.toThrow("reservation_unknown");
  expect((await service.release("workspace", first.id, true)).state).toBe("released");
  const retried = await service.reserve("workspace", "transcriptionSeconds", 5, "audio");
  expect(retried.id).toBe(first.id);
  expect(retried.state).toBe("reserved");
});
test("settlement recovery commits once and retains immutable measurements", async () => {
  const { service, connection } = await fixture();
  const first = await service.reserve("workspace", "answers", 1, "request");
  connection.client.query("INSERT INTO next_usage_settlements(reservation_id,workspace_id,action,actual,measurement) VALUES(?,?,?,?,?)")
    .run(first.id, "workspace", "commit", 1, JSON.stringify(unmeasuredUsage));
  expect(await service.reconcile()).toBe(1);
  expect(await service.reconcile()).toBe(0);
  await expect(service.commit("workspace", first.id, 0, { ...unmeasuredUsage })).rejects.toThrow("reservation_conflict");
});
