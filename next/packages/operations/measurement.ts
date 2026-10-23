import type { Operation, OperationResult } from "./domain.ts";
import type { UsageMeasurement } from "../accounting/domain.ts";

export function completedCharge(
  operation: Operation,
  result: Pick<OperationResult, "model" | "usage">,
) {
  const audio = operation.kind === "transcription";
  const metadata = operation.snapshot?.metadata;
  const measurement: UsageMeasurement = {
    model: result.model,
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
    priceVersion: null,
    source: audio
      ? metadata?.measuredDuration
        ? "duration"
        : "unavailable"
      : result.usage
        ? "provider"
        : "unavailable",
  };
  return { actual: audio ? (metadata?.durationSeconds ?? 1) : 1, measurement };
}
