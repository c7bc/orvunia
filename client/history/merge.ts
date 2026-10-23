import { historyKinds, orderedHistory } from "./view";
import type { HistoryView, HistoryKind, HistoryPage } from "./view";
export function mergeSessionView(
  previous: HistoryView | null | undefined,
  next: HistoryView,
) {
  if (
    !previous?.history ||
    !next.history ||
    previous.id !== next.id ||
    previous.history.generation !== next.history.generation
  )
    return next;
  const result = { ...next, history: { ...next.history } };
  for (const kind of historyKinds) {
    const old = previous[kind] || [],
      incoming = next[kind] || [];
    const overlap = incoming.some((item) =>
      old.some((known) => known.id === item.id),
    );
    if (
      !previous.history[kind].expanded ||
      !old.length ||
      !overlap ||
      next.history[kind].total < old.length
    )
      continue;
    result[kind] = orderedHistory([...old, ...incoming]);
    result.history[kind] = {
      ...next.history[kind],
      before: previous.history[kind].before,
      expanded: true,
    };
  }
  return result;
}
export function mergeHistoryPage(
  session: HistoryView,
  kind: HistoryKind,
  page: HistoryPage,
) {
  if (
    !historyKinds.includes(kind) ||
    !session?.history ||
    page.generation !== session.history.generation
  )
    throw Error("O histórico mudou. Recarregue a sessão.");
  return {
    ...session,
    [kind]: orderedHistory([...page.items, ...session[kind]]),
    history: {
      ...session.history,
      [kind]: {
        total: page.total,
        before: page.before,
        generation: page.generation,
        expanded: true,
      },
    },
  };
}
