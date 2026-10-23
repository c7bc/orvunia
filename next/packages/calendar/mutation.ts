import type { CalendarRecord } from "./domain.ts";
import { CalendarError, emptyCalendar } from "./domain.ts";
import type { CalendarRepository } from "./repository.ts";
export function calendarMutation(repository: CalendarRepository) {
  return async (
    workspaceId: string,
    decide: (current: CalendarRecord) => CalendarRecord | null,
  ) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const saved = await repository.find(workspaceId);
      const current = saved ?? emptyCalendar(workspaceId);
      const next = decide(structuredClone(current));
      if (!next) return current;
      if (next.workspaceId !== workspaceId)
        throw new CalendarError("calendar_conflict");
      next.revision = current.revision + 1;
      if (
        saved
          ? await repository.replace(next, current.revision)
          : await repository.insert(next)
      )
        return next;
    }
    throw new CalendarError("calendar_conflict");
  };
}
