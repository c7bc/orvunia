export type Draft = {
  recipient: string;
  subject: string;
  body: string;
  revision: number;
  updatedAt: string;
};
export type DraftInput = Pick<Draft, "recipient" | "subject" | "body"> & {
  expectedRevision: number;
};
export type DeliveryState =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "unknown"
  | "expired";
export type Delivery = {
  id: string;
  workspaceId: string;
  conversationId: string;
  revision: number;
  requestId: string;
  draftHash: string;
  state: DeliveryState;
  providerId: string;
  createdAt: number;
  ciphertext: string;
  expiresAt: number;
  claimedAt: number | null;
  attempts: number;
  retryAt: number;
};
export class FollowupError extends Error {
  constructor(
    readonly code:
      | "followup_conflict"
      | "followup_disabled"
      | "followup_verification"
      | "followup_limit"
      | "conversation_not_found"
      | "invalid_input",
    readonly status = 409,
  ) {
    super(code);
  }
}
export function saveDraft(
  current: Draft | null,
  input: DraftInput,
  updatedAt: string,
): Draft {
  if ((current?.revision ?? 0) !== input.expectedRevision)
    throw new FollowupError("followup_conflict");
  if (
    current &&
    current.recipient === input.recipient &&
    current.subject === input.subject &&
    current.body === input.body
  )
    return current;
  return {
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    revision: (current?.revision ?? 0) + 1,
    updatedAt,
  };
}
export function publicDelivery(delivery: Delivery | null, now: number) {
  if (!delivery) return null;
  const status =
    delivery.state === "completed"
      ? "accepted"
      : delivery.state === "failed" ||
          (delivery.state === "expired" && delivery.attempts === 0)
        ? "rejected"
        : ["unknown", "expired"].includes(delivery.state) ||
            (delivery.state === "processing" &&
              (delivery.claimedAt ?? 0) < now - 180_000)
          ? "unconfirmed"
          : "sending";
  return {
    id: delivery.id,
    revision: delivery.revision,
    status,
    messageId: delivery.providerId,
    date: new Date(delivery.createdAt).toISOString(),
  };
}
