import type { ReserveInput } from "./contracts";
import { requireCondition } from "./errors";

export function validateReservation(input: ReserveInput): void {
  for (const value of [input.owner, input.requestId, input.product]) {
    requireCondition(value.trim().length > 0 && value.length <= 128, "invalid_identity");
  }
  requireCondition(Number.isSafeInteger(input.quantity) && input.quantity > 0, "invalid_quantity");
  requireCondition(
    Number.isSafeInteger(input.lifetimeMilliseconds)
      && input.lifetimeMilliseconds >= 1
      && input.lifetimeMilliseconds <= 3_600_000,
    "invalid_lifetime",
  );
}

export function reservationFingerprint(input: ReserveInput): string {
  return JSON.stringify([input.product, input.quantity, input.lifetimeMilliseconds]);
}

export function receiptKey(owner: string, requestId: string): string {
  return JSON.stringify([owner, requestId]);
}
