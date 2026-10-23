import { DeliveryError } from "./domain.ts";
import type { EmailTransport } from "./domain.ts";
import type { NotificationRepository } from "./repository.ts";

export function notificationDelivery(
  repository: Pick<NotificationRepository, "claim" | "complete" | "fail">,
  transport: EmailTransport,
) {
  return async function deliver(id: string, lastAttempt: boolean) {
    const email = await repository.claim(id);
    if (!email) return;
    let providerId: string;
    try {
      ({ providerId } = await transport.send(id, email));
    } catch (error) {
      const kind = error instanceof DeliveryError ? error.kind : "unknown";
      await repository.fail(
        id,
        kind === "retryable"
          ? lastAttempt
            ? "failed"
            : "queued"
          : kind === "permanent"
            ? "failed"
            : "unknown",
      );
      if (kind === "retryable" && !lastAttempt) throw error;
      return;
    }
    await repository.complete(id, providerId);
  };
}
