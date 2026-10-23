import type {
  Clock, IdentifierGenerator, InventoryStore, Reservation, ReserveInput,
} from "../domain/contracts";
import { InventoryError, requireCondition } from "../domain/errors";
import { receiptKey, reservationFingerprint, validateReservation } from "../domain/validation";

export class InventoryService {
  constructor(
    private readonly store: InventoryStore,
    private readonly clock: Clock,
    private readonly identifiers: IdentifierGenerator,
  ) {}

  reserve(input: ReserveInput): Promise<Reservation> {
    validateReservation(input);
    return this.store.transaction((state) => {
      const key = receiptKey(input.owner, input.requestId);
      const fingerprint = reservationFingerprint(input);
      const receipt = state.receipts.get(key);
      if (receipt) {
        requireCondition(receipt.fingerprint === fingerprint, "idempotency_conflict");
        const existing = state.reservations.get(receipt.reservationId);
        requireCondition(existing !== undefined, "corrupt_receipt");
        return { ...existing };
      }

      const available = state.available.get(input.product);
      requireCondition(available !== undefined, "product_not_found");
      requireCondition(available >= input.quantity, "insufficient_stock");
      const expiresAt = this.clock.now() + input.lifetimeMilliseconds;
      requireCondition(Number.isSafeInteger(expiresAt), "invalid_expiration");
      const reservation: Reservation = {
        id: this.identifiers.next(), owner: input.owner, product: input.product,
        quantity: input.quantity, expiresAt, status: "reserved",
      };
      requireCondition(!state.reservations.has(reservation.id), "identifier_collision");
      state.available.set(input.product, available - input.quantity);
      state.reservations.set(reservation.id, reservation);
      state.receipts.set(key, { reservationId: reservation.id, fingerprint });
      return { ...reservation };
    });
  }

  confirm(owner: string, reservationId: string): Promise<Reservation> {
    return this.store.transaction((state) => {
      const reservation = state.reservations.get(reservationId);
      if (!reservation || reservation.owner !== owner) throw new InventoryError("reservation_not_found");
      if (reservation.status === "confirmed") return { ...reservation };
      requireCondition(reservation.status === "reserved", "invalid_transition");
      requireCondition(this.clock.now() < reservation.expiresAt, "reservation_expired");
      const confirmed: Reservation = { ...reservation, status: "confirmed" };
      state.reservations.set(reservationId, confirmed);
      return { ...confirmed };
    });
  }

  stock(product: string): Promise<number> {
    return this.store.transaction((state) => {
      const available = state.available.get(product);
      requireCondition(available !== undefined, "product_not_found");
      return available;
    });
  }

  reservation(owner: string, reservationId: string): Promise<Reservation> {
    return this.store.transaction((state) => {
      const reservation = state.reservations.get(reservationId);
      if (!reservation || reservation.owner !== owner) throw new InventoryError("reservation_not_found");
      return { ...reservation };
    });
  }
}
