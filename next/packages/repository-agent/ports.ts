import type { ExecutionAccounting } from "../accounting/port.ts";
import type { AgentJob, AgentModel, AgentOwner, AgentStore, AgentUsageRecorder } from "./domain.ts";

export type AgentDependencies = {
  admission?: import("../operations/execution.ts").ExecutionDependencies["admission"];
  store: AgentStore;
  accounting: ExecutionAccounting;
  usage: AgentUsageRecorder;
  identifier(): string;
  clock(): number;
  authorized(owner: AgentOwner): Promise<boolean>;
  historyGeneration(owner: AgentOwner): Promise<number>;
  validateSources(owner: AgentOwner, ids: readonly string[] | undefined, historyGeneration: number): Promise<void>;
  model(owner: AgentOwner): Promise<AgentModel>;
  complete(job: AgentJob): Promise<void>;
};
