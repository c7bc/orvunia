import { UsageError } from "./domain.ts";
import type { Reservation, UsageChange } from "./domain.ts";
export function changeUsage(
  current: Reservation,
  change: UsageChange,
): Reservation {
  if (change.action === "commit") {
    if (
      !Number.isSafeInteger(change.actual) ||
      change.actual < 0 ||
      change.actual > current.units
    )
      throw new UsageError("invalid_input");
    for (const tokens of [
      change.measurement.inputTokens,
      change.measurement.outputTokens,
    ])
      if (tokens !== null && (!Number.isSafeInteger(tokens) || tokens < 0))
        throw new UsageError("invalid_input");
    if (current.state === "committed") {
      const fields = [
        "model",
        "inputTokens",
        "outputTokens",
        "priceVersion",
        "source",
      ] as const;
      if (
        current.actual !== change.actual ||
        fields.some(
          (field) => current.measurement[field] !== change.measurement[field],
        )
      )
        throw new UsageError("reservation_conflict");
      return current;
    }
    if (current.state === "released")
      throw new UsageError("reservation_conflict");
    return {
      ...current,
      state: "committed",
      actual: change.actual,
      measurement: change.measurement,
    };
  }
  if (change.action === "release") {
    if (current.state === "committed" || current.state === "released")
      return current;
    if (current.state === "unknown" && !change.confirmedNotBillable)
      throw new UsageError("reservation_unknown");
    return { ...current, state: "released" };
  }
  if (change.action === "unknown")
    return current.state === "reserved"
      ? { ...current, state: "unknown" }
      : current;
  return current.state === "reserved"
    ? {
        ...current,
        leaseUntil: Math.max(current.leaseUntil, change.leaseUntil),
      }
    : current;
}

export function reserveLocal(candidate: Reservation, existing: Reservation | null): Reservation {
  if (!existing) return candidate;
  if (existing.units !== candidate.units || existing.workspaceId !== candidate.workspaceId || existing.kind !== candidate.kind)
    throw new UsageError("reservation_conflict");
  if (existing.state === "released") return { ...candidate, id: existing.id };
  return existing.state === "reserved" && existing.leaseUntil <= candidate.createdAt
    ? { ...existing, state: "unknown" } : existing;
}
