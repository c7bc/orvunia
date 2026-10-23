import { InventoryService } from "../../src/application/inventory";
import type { ReserveInput } from "../../src/domain/contracts";
import { MemoryInventoryStore } from "../../src/infrastructure/memory";

export function fixture(quantity = 10) {
  let instant = 1_000;
  let identifier = 0;
  const store = new MemoryInventoryStore({ keyboard: quantity });
  const service = new InventoryService(store, { now: () => instant }, {
    next: () => `reservation-${++identifier}`,
  });
  const input: ReserveInput = {
    owner: "candidate", requestId: "request-1", product: "keyboard",
    quantity: 2, lifetimeMilliseconds: 100,
  };
  return { service, store, input, advance: (milliseconds: number) => { instant += milliseconds; } };
}
