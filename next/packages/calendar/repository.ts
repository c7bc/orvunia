import type { CalendarRecord } from "./domain.ts";
export interface CalendarRepository {
  find(workspaceId: string): Promise<CalendarRecord | null>;
  byState(hash: string): Promise<CalendarRecord | null>;
  insert(record: CalendarRecord): Promise<boolean>;
  replace(record: CalendarRecord, expectedRevision: number): Promise<boolean>;
}
