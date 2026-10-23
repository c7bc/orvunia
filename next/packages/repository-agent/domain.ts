export type RepositoryBinding = { grantId: string; revision: number; snapshotSha256: string };
export type AgentOwner = { workspaceId: string; actorId: string; sessionId: string };
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type AgentMessage =
  | { kind: "question"; text: string }
  | { kind: "provider"; output: Json[] }
  | { kind: "tool"; callId: string; output: string };
export type ToolCall = { callId: string; name: string; arguments: string };
export type PendingTool = ToolCall & { token: string; result?: string };
export type AgentStatus = "ready" | "invoking" | "waiting_tools" | "completed" | "cancelled" | "unknown" | "failed";
export type AgentJob = {
  id: string;
  owner: AgentOwner;
  historyGeneration: number;
  sourceTranscriptIds?: string[];
  providerFingerprint: string;
  requestId: string;
  fingerprint: string;
  binding: RepositoryBinding;
  status: AgentStatus;
  version: number;
  turns: number;
  tools: number;
  bytes: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
  pending: PendingTool[];
  answer: string | null;
  error: string | null;
  reservationId: string | null;
  cancelRequested: boolean;
};
export type AgentTurn = {
  failure?: string;
  output: Json[];
  calls: ToolCall[];
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};
export type AgentUsage = { jobId: string; turn: number; reservationId: string; state: "known" | "unknown";
  model: string | null; inputTokens: number | null; outputTokens: number | null;
  cachedInputTokens: number | null; reasoningTokens: number | null };
export interface AgentUsageRecorder { record(owner: AgentOwner, usage: AgentUsage): Promise<void> }
export interface AgentModel {
  readonly fingerprint: string;
  turn(messages: AgentMessage[], maximumOutputTokens: number, signal: AbortSignal, toolsRemaining: number,
    onText?: (delta: string) => void): Promise<AgentTurn>;
}
export interface AgentStore {
  create(job: AgentJob): Promise<AgentJob>;
  find(owner: AgentOwner, id: string): Promise<AgentJob | null>;
  receipt(owner: AgentOwner, requestId: string): Promise<AgentJob | null>;
  recent(owner: AgentOwner, binding: RepositoryBinding, generation: number): Promise<AgentJob[]>;
  save(job: AgentJob, expectedVersion: number): Promise<boolean>;
}
export class RepositoryAgentError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
