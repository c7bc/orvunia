export type ExpansionStage = {
  sourceId: string;
  workspaceId: string;
  conversationId: string;
  requestId: string;
  expiresAt: number;
  revealed: boolean;
  cancelled: boolean;
  contextSource: "original-snapshot" | "saved-answer-only";
};
export class ExpansionError extends Error {
  constructor(
    readonly code:
      | "response_not_found"
      | "expansion_not_found"
      | "expansion_pending"
      | "expansion_expired",
  ) {
    super(code);
  }
}
