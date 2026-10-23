import { historyKinds, HISTORY_PAGE_SIZES, historyTotal } from "./view";
import type {
  HistoryView,
  HistoryKind,
  HistoryItem,
  PageOptions,
} from "./view";
import { pageAnchors } from "./anchors";
export function createHistoryPager({
  sizes = {},
  maxViews = 64,
}: { sizes?: Partial<Record<HistoryKind, number>>; maxViews?: number } = {}) {
  const anchors = pageAnchors(maxViews);
  const limits: Record<HistoryKind, number> = { ...HISTORY_PAGE_SIZES };
  for (const kind of historyKinds) {
    const requested = Number(sizes[kind]);
    if (Number.isFinite(requested) && requested > 0)
      limits[kind] = Math.max(1, Math.min(200, Math.floor(requested)));
  }
  function inspect<Item extends HistoryItem>(
    session: HistoryView,
    kind: HistoryKind,
    options: PageOptions<Item>,
    source: readonly Item[],
  ) {
    const state = anchors.record(session, kind, options),
      items = options.filter ? source.filter(options.filter) : source,
      size = limits[kind];
    let start = Math.max(0, items.length - size),
      end = items.length,
      invalidated = false;
    if (!state.followingLatest) {
      const first = items.findIndex((item) => item.id === state.first),
        last = items.findIndex((item) => item.id === state.last);
      if (first >= 0 || last >= 0) {
        start = first >= 0 ? first : Math.max(0, last + 1 - size);
        end = last >= start ? last + 1 : Math.min(items.length, start + size);
        end = Math.min(end, start + size);
      } else {
        state.followingLatest = true;
        state.first = state.last = null;
        invalidated = true;
      }
    }
    const visible = items.slice(start, end),
      before = session.history?.[kind]?.before ?? null;
    return {
      state,
      all: items,
      page: {
        items: visible,
        start,
        end,
        loaded: items.length,
        total: historyTotal(session, kind),
        pageSize: size,
        before,
        hasOlder: start > 0 || Boolean(before),
        hasNewer: end < items.length,
        newerCount: items.length - end,
        followingLatest: state.followingLatest,
        needsOlder: false,
        invalidated,
        key: JSON.stringify([
          session.id,
          kind,
          state.generation,
          visible.map((item) => item.id),
        ]),
      },
    };
  }
  const page = <Session extends HistoryView, Kind extends HistoryKind>(
    session: Session,
    kind: Kind,
    options: PageOptions<Session[Kind][number]> = {},
  ) =>
    inspect<Session[Kind][number]>(session, kind, options, session[kind] || [])
      .page;
  function move<Session extends HistoryView, Kind extends HistoryKind>(
    session: Session,
    kind: Kind,
    direction: "older" | "newer" | "latest",
    options: PageOptions<Session[Kind][number]> = {},
  ) {
    if (!["older", "newer", "latest"].includes(direction))
      throw TypeError("Direção do histórico inválida.");
    const {
      state,
      all,
      page: current,
    } = inspect<Session[Kind][number]>(
      session,
      kind,
      options,
      session[kind] || [],
    );
    if (direction === "latest") {
      state.followingLatest = true;
      state.first = state.last = null;
      return page<Session, Kind>(session, kind, options);
    }
    if (direction === "older" && current.start === 0)
      return { ...current, needsOlder: Boolean(current.before) };
    if (direction === "newer" && !current.hasNewer) return current;
    const end =
        direction === "older"
          ? current.start
          : Math.min(all.length, current.end + current.pageSize),
      start =
        direction === "older"
          ? Math.max(0, end - current.pageSize)
          : current.end;
    state.followingLatest =
      direction === "newer" &&
      end === all.length &&
      start === Math.max(0, all.length - current.pageSize);
    state.first = state.followingLatest ? null : (all[start]?.id ?? null);
    state.last = state.followingLatest ? null : (all[end - 1]?.id ?? null);
    return page<Session, Kind>(session, kind, options);
  }
  return { page, move, clear: anchors.clear };
}
