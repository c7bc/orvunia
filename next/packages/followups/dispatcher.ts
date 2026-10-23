import type { FollowupOutbox } from "./repository.ts";
import type { EmailTransport } from "../notifications/domain.ts";
import { notificationDelivery } from "../notifications/deliver.ts";
export function followupDispatcher(
  repository: FollowupOutbox,
  transport: EmailTransport,
  onError: () => void,
) {
  const deliver = notificationDelivery(repository, transport);
  let active: Promise<void> | null = null,
    closed = false;
  function dispatch(): Promise<void> {
    if (closed) return Promise.resolve();
    if (active) return active;
    active = (async () => {
      await repository.recover();
      for (const id of await repository.pending(25)) {
        if (closed) break;
        await deliver(id, (await repository.attempts(id)) >= 2).catch(onError);
      }
    })().finally(() => {
      active = null;
    });
    return active;
  }
  const timer = setInterval(() => {
    void dispatch().catch(onError);
  }, 1000);
  timer.unref();
  return {
    dispatch,
    async close() {
      closed = true;
      clearInterval(timer);
      if (active) await active;
    },
  };
}
