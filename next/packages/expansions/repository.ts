import type { ExpansionStage } from "./domain.ts";
import type { Answer } from "../sessions/domain.ts";
export interface ExpansionRepository {
  find(
    workspaceId: string,
    conversationId: string,
    sourceId: string,
  ): Promise<ExpansionStage | null>;
  create(stage: ExpansionStage): Promise<ExpansionStage>;
  reset(
    workspaceId: string,
    sourceId: string,
    requestId: string,
  ): Promise<void>;
  cancel(
    workspaceId: string,
    sourceId: string,
    requestId: string,
  ): Promise<void>;
  reveal(
    workspaceId: string,
    sourceId: string,
    requestId: string,
    now: number,
  ): Promise<Answer>;
}
