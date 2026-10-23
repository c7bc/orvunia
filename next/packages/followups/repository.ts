import type { Draft, DraftInput, Delivery } from "./domain.ts";
import type { NotificationRepository } from "../notifications/repository.ts";
export interface FollowupRepository {
  draft(workspaceId: string, conversationId: string): Promise<Draft | null>;
  save(
    workspaceId: string,
    conversationId: string,
    input: DraftInput,
    updatedAt: string,
  ): Promise<Draft>;
  receipt(workspaceId: string, requestId: string): Promise<Delivery | null>;
  latest(workspaceId: string, conversationId: string): Promise<Delivery | null>;
  queue(
    candidate: Delivery,
    dailyLimit: number,
  ): Promise<{ delivery: Delivery; repeated: boolean }>;
}
export type FollowupOutbox = Pick<
  NotificationRepository,
  "pending" | "queued" | "claim" | "complete" | "fail" | "recover"
> & {
  attempts(id: string): Promise<number>;
};
