import { LocalModelError } from "./domain.ts";
import type { ModelLifecycle } from "./lifecycle.ts";

type Closeable = { close(): Promise<void> };
export async function closeLocalModels(input: {
  benchmarks: Closeable;
  queue: Closeable;
  imports: Closeable;
  lifecycle: Pick<ModelLifecycle, "status" | "unload">;
}): Promise<void> {
  const failures: unknown[] = [];
  try { await input.benchmarks.close(); } catch (error) { failures.push(error); }
  const transfers = await Promise.allSettled([input.queue.close(), input.imports.close()]);
  for (const result of transfers) if (result.status === "rejected") failures.push(result.reason);
  for (const active of input.lifecycle.status()) {
    try {
      if (active.inUse) throw new LocalModelError("runtime_in_use", 409);
      await input.lifecycle.unload(active.installationId);
    } catch (error) { failures.push(error); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "local_models_shutdown_failed");
}
