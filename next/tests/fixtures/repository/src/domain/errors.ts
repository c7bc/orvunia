export class InventoryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "InventoryError";
  }
}

export function requireCondition(condition: boolean, code: string): asserts condition {
  if (!condition) throw new InventoryError(code);
}
