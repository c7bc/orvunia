import type { Operation } from "../../operations/domain.ts";
import { completedCharge } from "../../operations/measurement.ts";
import { unmeasuredUsage } from "../../accounting/domain.ts";
import type { SqliteConnection } from "./connection.ts";
import { usageSettlements } from "./settlement-schema.ts";
export function persistOutcome(
  database: SqliteConnection["database"],
  current: Operation,
  next: Operation,
) {
  if (
    !next.reservationId ||
    current.state === "completed" ||
    !["failed", "unknown"].includes(next.state)
  )
    return;
  if (!next.partial && next.state !== "failed") return;
  const charge = next.partial
    ? completedCharge(next, {
        model: next.snapshot?.provider.model ?? "unknown",
      })
    : { actual: 0, measurement: { ...unmeasuredUsage } };
  database
    .insert(usageSettlements)
    .values({
      reservationId: next.reservationId,
      workspaceId: next.workspaceId,
      action: next.partial ? "commit" : "release",
      ...charge,
    })
    .onConflictDoNothing()
    .run();
}
