import type { Reservation, UsageChange, UsageMeasurement } from "./domain.ts";

export interface AccountingRepository {
  reserve(candidate: Reservation): Promise<Reservation>;
  change(workspaceId: string, id: string, change: UsageChange): Promise<Reservation>;
  settlements(limit: number): Promise<{
    action: "commit" | "release";
    reservationId: string;
    workspaceId: string;
    actual: number;
    measurement: UsageMeasurement;
  }[]>;
  acknowledge(id: string): Promise<void>;
  markExpiredUnknown(now: number): Promise<void>;
}
