import type { Reservation, UsageKind, UsageMeasurement } from "./domain.ts";

export interface ExecutionAccounting {
  reserve(workspaceId: string, kind: UsageKind, units: number, requestKey: string): Promise<Reservation>;
  commit(workspaceId: string, id: string, actual: number, measurement: UsageMeasurement): Promise<Reservation>;
  release(workspaceId: string, id: string, confirmedNotBillable?: boolean): Promise<Reservation>;
  unknown(workspaceId: string, id: string): Promise<Reservation>;
  renew(workspaceId: string, id: string): Promise<Reservation>;
  reconcile(): Promise<number>;
}
