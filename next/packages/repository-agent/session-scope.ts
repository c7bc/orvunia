import type { SessionRepository } from "../sessions/repository.ts";

export function repositorySessionScope(repository: SessionRepository) {
  type Invalidated = (workspaceId: string, sessionId: string) => Promise<void>;
  const listeners = new Set<Invalidated>();
  const invalidate = (workspaceId: string, sessionId: string) =>
    Promise.all([...listeners].map((listener) => listener(workspaceId, sessionId)));
  const sessions: SessionRepository = {
    create: repository.create.bind(repository), find: repository.find.bind(repository),
    list: repository.list.bind(repository), resume: repository.resume.bind(repository),
    legacySegment: repository.legacySegment.bind(repository), latestSummary: repository.latestSummary.bind(repository),
    entries: repository.entries.bind(repository), entry: repository.entry.bind(repository), counts: repository.counts.bind(repository),
    async change(workspaceId, id, decide) {
      let invalidated = false;
      const result = await repository.change(workspaceId, id, (session) => {
        const previousGeneration = session.historyGeneration, previousState = session.state;
        const change = decide(session);
        invalidated = Boolean(change.remove) || change.clear !== undefined || change.next.historyGeneration !== previousGeneration
          || (change.next.state === "ended" && previousState !== "ended");
        return change;
      });
      if (invalidated) await invalidate(workspaceId, id);
      return result;
    },
    async remove(workspaceId, id) {
      const removed = await repository.remove(workspaceId, id);
      if (removed) await invalidate(workspaceId, id);
      return removed;
    },
  };
  return { sessions, onInvalidate(listener: Invalidated) { listeners.add(listener); return () => listeners.delete(listener); } };
}
