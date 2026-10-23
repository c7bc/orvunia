import { expect, test } from "bun:test";
import { closeLocalModels } from "../../packages/local-models/shutdown.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { deferred } from "../support/benchmarks.ts";

test("benchmark storage failure is rethrown only after transfers drain and runtimes unload", async () => {
  const failure = new LocalModelError("benchmark_persistence_failed", 503);
  const order: string[] = []; const queueDrain = deferred(); const importsDrain = deferred();
  const active = { installationId: "loaded", inUse: false, handle: {
    id: "handle", installationId: "loaded", runtime: "llama.cpp" as const, capabilities: ["text" as const] },
    settings: { contextTokens: 128, maximumOutputTokens: 64, threads: 1 } };
  const pending = closeLocalModels({
    benchmarks: { async close() { order.push("benchmarks"); throw failure; } },
    queue: { async close() { order.push("queue"); await queueDrain.promise; order.push("queue-drained"); } },
    imports: { async close() { order.push("imports"); await importsDrain.promise; order.push("imports-drained"); } },
    lifecycle: { status: () => [active], async unload() { order.push("unload"); } },
  }).catch(error => error);
  await Bun.sleep(0); expect(order).toEqual(["benchmarks", "queue", "imports"]);
  queueDrain.resolve(); await Bun.sleep(0); expect(order).not.toContain("unload");
  importsDrain.resolve(); expect(await pending).toBe(failure);
  expect(order).toEqual(["benchmarks", "queue", "imports", "queue-drained", "imports-drained", "unload"]);
});

test("shutdown attempts all owned cleanup and retains multiple errors without forcing a handle in use", async () => {
  const errors = [Error("benchmark"), Error("queue")]; let unloads = 0;
  const handle = { id: "handle", installationId: "busy", runtime: "llama.cpp" as const, capabilities: ["text" as const] };
  const result = await closeLocalModels({ benchmarks: { async close() { throw errors[0]; } },
    queue: { async close() { throw errors[1]; } }, imports: { async close() {} },
    lifecycle: { status: () => [{ installationId: "busy", inUse: true, handle,
      settings: { contextTokens: 128, maximumOutputTokens: 64, threads: 1 } },
    { installationId: "idle", inUse: false, handle: { ...handle, installationId: "idle" },
      settings: { contextTokens: 128, maximumOutputTokens: 64, threads: 1 } }],
    async unload() { unloads++; } },
  }).catch(error => error);
  expect(result).toBeInstanceOf(AggregateError);
  expect(result.errors).toHaveLength(3); expect(result.errors.slice(0, 2)).toEqual(errors);
  expect(result.errors[2]).toMatchObject({ code: "runtime_in_use" }); expect(unloads).toBe(1);
});
