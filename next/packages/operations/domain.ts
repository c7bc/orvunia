import type { SnapshotCapabilities } from "./snapshot-capabilities.ts";
export type OperationKind =
  "answer" | "transcription" | "expansion" | "followup";
export type OperationState =
  | "prepared"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown"
  | "expired";
export type SnapshotImage = {
  id: string;
  key: string;
  mime: string;
  bytes: number;
  hash: string;
};
export type ProviderSnapshot = {
  provider: string;
  baseUrl: string;
  model: string;
  vision: boolean;
  maxTokens: number;
};
type SnapshotContext = {
  instructions: string;
  context: string;
  images: SnapshotImage[];
  provider: ProviderSnapshot;
  metadata: {
    action: string;
    mode: "recruiter" | "technical";
    question: string;
    sourceTranscriptIds?: string[];
    who?: string;
    time?: string;
    segmentId?: string;
    durationSeconds?: number;
    measuredDuration?: boolean;
    publish?: boolean;
  };
  allowEnded: boolean;
  historyGeneration?: number;
  retainedFrom?: { kind: OperationKind; id: string };
};
export type OperationSnapshot = SnapshotContext & (
  { version: 1 } | { version: 2; capabilities: SnapshotCapabilities }
);
export type OperationResult = {
  id: string;
  text: string;
  model: string;
  captureIds: string[];
  sourceTranscriptIds?: string[];
  usage?: { inputTokens: number; outputTokens: number };
  empty?: boolean;
};
export type Operation = {
  id: string;
  kind: OperationKind;
  workspaceId: string;
  conversationId: string;
  requestHash: string;
  state: OperationState;
  attempt: number;
  snapshot: OperationSnapshot | null;
  snapshotBytes: number;
  result: OperationResult | null;
  lease: string;
  leaseUntil: number;
  expiresAt: number;
  createdAt: number;
  cancelRequested: boolean;
  providerStarted: boolean;
  partial: boolean;
  reservationId: string | null;
};
export type ClaimContext = {
  existing: Operation | null;
  session: { state: string; historyGeneration?: number } | undefined;
  activeCount: number;
  retainedBytes: number;
};
export type OperationFailure = { known: boolean; partial: boolean };
export class OperationError extends Error {
  constructor(
    readonly code:
      | "request_conflict"
      | "operation_busy"
      | "operation_unknown"
      | "operation_expired"
      | "snapshot_limit"
      | "history_changed"
      | "conversation_not_found"
      | "conversation_ended"
      | "asset_not_found"
      | "unauthorized",
  ) {
    super(code);
  }
}
