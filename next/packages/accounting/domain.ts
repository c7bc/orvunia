export type UsageKind = "answers" | "transcriptionSeconds";
export type UsageState = "reserved" | "committed" | "released" | "unknown";
export type UsageMeasurement = {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  priceVersion: string | null;
  source: "provider" | "duration" | "unavailable";
};
export type Reservation = {
  id: string;
  workspaceId: string;
  requestKey: string;
  kind: UsageKind;
  period: string;
  units: number;
  actual: number;
  state: UsageState;
  createdAt: number;
  leaseUntil: number;
  measurement: UsageMeasurement;
};
export type UsageChange =
  | { action: "commit"; actual: number; measurement: UsageMeasurement }
  | { action: "release"; confirmedNotBillable: boolean }
  | { action: "unknown" }
  | { action: "renew"; leaseUntil: number };
export class UsageError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "usage_limit"
      | "daily_usage_limit"
      | "monthly_usage_limit"
      | "global_usage_limit"
      | "reservation_conflict"
      | "reservation_unknown",
    readonly details?: { scope: "daily" | "monthly"; resetAt: string },
  ) {
    super(code);
  }
}

export const unmeasuredUsage = Object.freeze<UsageMeasurement>({
  model: null, inputTokens: null, outputTokens: null, priceVersion: null, source: "unavailable",
});
