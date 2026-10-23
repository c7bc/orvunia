import type { OperationResult } from "./domain.ts";
import type { OperationRepository } from "./repository.ts";
import type { ExecutionAccounting } from "../accounting/port.ts";
import type { UsageKind } from "../accounting/domain.ts";

export type ExecutionDependencies = {
  operations: OperationRepository;
  usage: ExecutionAccounting;
  clock(): number;
  log(event: { event: string; operationId: string }): void;
  admission?: {
    enter(): Promise<{ renew(): Promise<boolean>; release(): Promise<void> }>;
  };
  heartbeatMs?: number;
};
export type Execution = {
  kind: UsageKind;
  units: number;
  prepare(
    signal: AbortSignal,
  ): Promise<(partial: () => void) => Promise<OperationResult>>;
  replay?: (result: OperationResult) => void;
};
