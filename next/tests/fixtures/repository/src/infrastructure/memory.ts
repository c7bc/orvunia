import type { InventoryState, InventoryStore } from "../domain/contracts";
import { requireCondition } from "../domain/errors";
import { Mutex } from "./mutex";

export class MemoryInventoryStore implements InventoryStore {
  private readonly mutex = new Mutex();
  private state: InventoryState;

  constructor(stock: Readonly<Record<string, number>>) {
    for (const quantity of Object.values(stock)) {
      requireCondition(Number.isSafeInteger(quantity) && quantity >= 0, "invalid_stock");
    }
    this.state = { available: new Map(Object.entries(stock)), reservations: new Map(), receipts: new Map() };
  }

  transaction<Result>(operation: (state: InventoryState) => Result): Promise<Result> {
    return this.mutex.exclusive(() => {
      const draft = structuredClone(this.state);
      const result = operation(draft);
      requireCondition(!(result instanceof Promise), "asynchronous_transaction_not_supported");
      this.state = draft;
      return result;
    });
  }
}
