export type ReservationStatus = "reserved" | "confirmed" | "cancelled" | "expired";

export interface Reservation {
  readonly id: string;
  readonly owner: string;
  readonly product: string;
  readonly quantity: number;
  readonly expiresAt: number;
  readonly status: ReservationStatus;
}

export interface ReserveInput {
  readonly owner: string;
  readonly requestId: string;
  readonly product: string;
  readonly quantity: number;
  readonly lifetimeMilliseconds: number;
}

export interface Receipt {
  readonly reservationId: string;
  readonly fingerprint: string;
}

export interface InventoryState {
  readonly available: Map<string, number>;
  readonly reservations: Map<string, Reservation>;
  readonly receipts: Map<string, Receipt>;
}

export interface InventoryStore {
  transaction<Result>(operation: (state: InventoryState) => Result): Promise<Result>;
}

export interface Clock {
  now(): number;
}

export interface IdentifierGenerator {
  next(): string;
}
