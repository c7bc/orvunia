import type { Operation } from "./domain.ts";

export type StageResult = { text: string; model: string; usage?: { inputTokens: number; outputTokens: number } };
export type OperationStage = {
  workspaceId: string;
  operationKind: Operation["kind"];
  operationId: string;
  stageId: string;
  inputHash: string;
  state: "running" | "completed" | "failed" | "unknown";
  lease: string;
  expiresAt: number;
  result: StageResult | null;
};
export interface OperationStageRepository {
  begin(operation: Operation, stageId: string, inputHash: string, now: number): Promise<OperationStage>;
  complete(operation: Operation, stageId: string, result: StageResult, now: number): Promise<void>;
  fail(operation: Operation, stageId: string, known: boolean): Promise<void>;
  purge(now: number): Promise<void>;
}
