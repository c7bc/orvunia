import { historyKinds } from "./view";
import type { HistoryView, HistoryKind, PageOptions, PageAnchor } from "./view";
export function pageAnchors(maxViews: number) {
  const views = new Map<string, PageAnchor>(),
    capacity = Number.isFinite(maxViews)
      ? Math.max(1, Math.min(256, Math.floor(maxViews)))
      : 64;
  return {
    record(
      session: HistoryView,
      kind: HistoryKind,
      options: Pick<PageOptions, "view">,
    ) {
      if (!session?.id || !historyKinds.includes(kind))
        throw TypeError("Sessão ou tipo de histórico inválido.");
      const key = JSON.stringify([session.id, kind, options.view ?? "default"]),
        generation = session.history?.generation ?? null;
      let state = views.get(key);
      if (!state || state.generation !== generation)
        state = { generation, followingLatest: true, first: null, last: null };
      views.delete(key);
      views.set(key, state);
      while (views.size > capacity) {
        const oldest = views.keys().next().value;
        if (oldest !== undefined) views.delete(oldest);
      }
      return state;
    },
    clear(sessionId?: string) {
      if (sessionId === undefined) views.clear();
      else
        for (const key of views.keys())
          if (JSON.parse(key)[0] === sessionId) views.delete(key);
    },
  };
}
