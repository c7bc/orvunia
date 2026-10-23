import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { SqliteOperationStages } from "../../packages/storage/sqlite/operation-stages.ts";

test("stage checkpoints require the owning live operation lease and immutable image/config fingerprint", async () => {
  const environment = await capabilityEnvironment();
  try {
    const operation = await environment.prepare();
    const stages = new SqliteOperationStages(environment.connection);
    await expect(stages.begin(operation, "vision:synthetic", "a".repeat(64), environment.now())).rejects.toMatchObject({ code: "request_conflict" });
    const reservation = await environment.reservation();
    await environment.operations.start(environment.owner, operation.kind, operation.id, operation.lease, reservation);
    await stages.begin(operation, "vision:synthetic", "a".repeat(64), environment.now());
    await expect(stages.begin({ ...operation, workspaceId: crypto.randomUUID() }, "vision:synthetic", "a".repeat(64), environment.now()))
      .rejects.toMatchObject({ code: "request_conflict" });
    await expect(stages.begin(operation, "vision:synthetic", "b".repeat(64), environment.now())).rejects.toMatchObject({ code: "request_conflict" });
    await expect(stages.complete({ ...operation, lease: crypto.randomUUID() }, "vision:synthetic", { text: "stale", model: "test" }, environment.now()))
      .rejects.toMatchObject({ code: "request_conflict" });
    await stages.complete(operation, "vision:synthetic", { text: "visible code", model: "vision-snapshot" }, environment.now());
    const replay = await stages.begin(operation, "vision:synthetic", "a".repeat(64), environment.now());
    expect(replay.state).toBe("completed"); expect(replay.result?.text).toBe("visible code");
  } finally { await environment.close(); }
});
test("visual text is bounded in bytes and cancellation fences final persistence", async () => {
  const environment = await capabilityEnvironment();
  try {
    const operation = await environment.prepare();
    await environment.operations.start(environment.owner, operation.kind, operation.id, operation.lease, await environment.reservation());
    const stages = new SqliteOperationStages(environment.connection);
    await stages.begin(operation, "vision:limit", "a".repeat(64), environment.now());
    await expect(stages.complete(operation, "vision:limit", { text: "é".repeat(17_000), model: "test" }, environment.now()))
      .rejects.toMatchObject({ code: "snapshot_limit" });
    await environment.operations.cancel(environment.owner, environment.session.id);
    await expect(stages.complete(operation, "vision:limit", { text: "late", model: "test" }, environment.now()))
      .rejects.toMatchObject({ code: "request_conflict" });
  } finally { await environment.close(); }
});
test("completed visual evidence expires with the original snapshot and is purged", async () => {
  const environment = await capabilityEnvironment();
  try {
    const operation = await environment.prepare();
    await environment.operations.start(environment.owner, operation.kind, operation.id, operation.lease, await environment.reservation());
    const stages = new SqliteOperationStages(environment.connection);
    await stages.begin(operation, "vision:expiry", "a".repeat(64), environment.now());
    await stages.complete(operation, "vision:expiry", { text: "temporary evidence", model: "test" }, environment.now());
    environment.advance(25 * 60 * 60_000);
    await environment.operations.recover(environment.now()); await stages.purge(environment.now());
    expect(environment.connection.client.query<{ count: number }, []>("SELECT count(*) AS count FROM next_operation_stages").get()?.count).toBe(0);
  } finally { await environment.close(); }
});
