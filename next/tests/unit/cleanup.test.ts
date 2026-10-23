import { expect, test } from "bun:test";
import { cleanupScope } from "../../packages/runtime/cleanup.ts";
test("a failed child cleanup still closes the queue, Redis and database once in reverse registration order", async () => {
  const scope = cleanupScope(),
    closed: string[] = [];
  scope.defer(() => {
    closed.push("database");
  });
  scope.defer(() => {
    closed.push("redis");
  });
  scope.defer(() => {
    closed.push("queue");
  });
  scope.defer(() => {
    closed.push("worker");
    throw Error("Synthetic child cleanup failure");
  });
  const results = await Promise.allSettled([scope.close(), scope.close()]);
  expect(closed).toEqual(["worker", "queue", "redis", "database"]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
});
