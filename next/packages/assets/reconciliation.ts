import type { AssetService } from "./service.ts";

export function reconciliationLoop(
  service: AssetService,
  onFailure: () => void,
) {
  let pending: Promise<unknown> | null = null;
  const timer = setInterval(() => {
    if (pending) return;
    pending = service
      .reconcile()
      .catch(onFailure)
      .finally(() => {
        pending = null;
      });
  }, 60_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
