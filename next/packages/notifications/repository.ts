import type { Email, EmailIntents } from "./domain.ts";

export interface NotificationRepository extends EmailIntents {
  pending(limit: number): Promise<string[]>;
  queued(id: string): Promise<void>;
  claim(id: string): Promise<Email | null>;
  complete(id: string, providerId: string): Promise<void>;
  fail(id: string, state: "queued" | "failed" | "unknown"): Promise<void>;
  recover(): Promise<void>;
}
