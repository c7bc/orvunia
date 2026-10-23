import type {
  HistoryKind,
  SessionRecord,
  SessionChange,
  StoredEntry,
  StoredEntryOf,
} from "./domain.ts";

export interface SessionRepository {
  legacySegment(
    workspaceId: string,
    conversationId: string,
    segmentId: string,
  ): Promise<import("./domain.ts").LegacySegment | null>;
  latestSummary(
    workspaceId: string,
    id: string,
  ): Promise<import("./domain.ts").Answer | null>;
  create(session: SessionRecord): Promise<SessionRecord>;
  find(workspaceId: string, id: string): Promise<SessionRecord | null>;
  list(
    workspaceId: string,
    limit: number,
    before?: string,
  ): Promise<SessionRecord[]>;
  change(
    workspaceId: string,
    id: string,
    decide: (session: SessionRecord) => SessionChange,
  ): Promise<{ session: SessionRecord; appended?: StoredEntry }>;
  resume(workspaceId: string, id: string): Promise<SessionRecord>;
  remove(workspaceId: string, id: string): Promise<boolean>;
  entries<Kind extends HistoryKind>(
    workspaceId: string,
    id: string,
    kind: Kind,
    options: { limit: number; before?: number; after?: number },
  ): Promise<StoredEntryOf<Kind>[]>;
  entry<Kind extends HistoryKind>(
    workspaceId: string,
    id: string,
    entryId: string,
    kind: Kind,
  ): Promise<StoredEntryOf<Kind> | null>;
  counts(workspaceId: string, id: string): Promise<Record<HistoryKind, number>>;
}
