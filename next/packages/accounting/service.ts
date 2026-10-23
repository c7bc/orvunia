import { UsageError, unmeasuredUsage } from "./domain.ts";
import type { ExecutionAccounting } from "./port.ts";
import type { AccountingRepository } from "./repository.ts";

export function localAccounting(
  repository: AccountingRepository,
  identifier: () => string,
  clock: () => number,
): ExecutionAccounting {
  const change: AccountingRepository["change"] = async (workspace, id, input) => {
    const result = await repository.change(workspace, id, input);
    if (input.action === "commit" || input.action === "release")
      await repository.acknowledge(id);
    return result;
  };
  return {
    async reserve(workspaceId, kind, units, requestKey) {
      if (!workspaceId || !["answers", "transcriptionSeconds"].includes(kind) ||
          !Number.isSafeInteger(units) || units < 1 || units > 10_000_000 ||
          !requestKey || requestKey.length > 200)
        throw new UsageError("invalid_input");
      const now = clock();
      const reservation = await repository.reserve({
        id: identifier(), workspaceId, kind, units, requestKey,
        period: new Date(now).toISOString().slice(0, 7),
        actual: 0, state: "reserved", createdAt: now, leaseUntil: now + 90_000,
        measurement: { ...unmeasuredUsage },
      });
      if (reservation.state === "unknown") throw new UsageError("reservation_unknown");
      return reservation;
    },
    commit: (workspace, id, actual, measurement) =>
      change(workspace, id, { action: "commit", actual, measurement }),
    release: (workspace, id, confirmedNotBillable = false) =>
      change(workspace, id, { action: "release", confirmedNotBillable }),
    unknown: (workspace, id) => change(workspace, id, { action: "unknown" }),
    renew: (workspace, id) => change(workspace, id, { action: "renew", leaseUntil: clock() + 90_000 }),
    async reconcile() {
      const outcomes = await repository.settlements(100);
      for (const outcome of outcomes)
        await change(outcome.workspaceId, outcome.reservationId,
          outcome.action === "commit"
            ? { action: "commit", actual: outcome.actual, measurement: outcome.measurement }
            : { action: "release", confirmedNotBillable: true });
      return outcomes.length;
    },
  };
}
