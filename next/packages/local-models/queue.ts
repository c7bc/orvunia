import type { ModelDownloads } from "./downloads.ts";
import type { ModelRegistry } from "./ports.ts";

export function modelQueue(downloads: ModelDownloads, registry: ModelRegistry) {
  let closing = false;
  let pending: Promise<void> | null = null;
  function tick() {
    if (closing || pending) return;
    pending = (async () => {
      for (const job of registry.listJobs()) {
        if (closing) break;
        if (job.state === "queued") await downloads.run(job.id);
      }
    })().finally(() => { pending = null; });
    // The job owns its durable failure state; a lifecycle conflict is retried next tick.
    void pending.catch(() => {});
  }
  const timer = setInterval(tick, 1000);
  timer.unref();
  return {
    wake: tick,
    async close() {
      closing = true;
      clearInterval(timer);
      await downloads.close();
      await pending?.catch(() => {});
    },
  };
}
