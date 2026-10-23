import type { PanelSession } from "../panel/data.js";
import type { HistoryPorts } from "./contracts.js";

export function createSessionIndexSearch<Session extends PanelSession>(
  ports: HistoryPorts<Session>,
) {
  return async function search(query: string, append = false) {
    const { state } = ports;
    const epoch = ++state.sessionSearchEpoch;
    const workspace = ports.workspace();
    const before = append
      ? query
        ? state.sessionSearchBefore
        : state.sessionIndexBefore
      : null;
    const result = await ports.index(
      `/session-index?limit=100&search=${encodeURIComponent(query)}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    );
    if (
      epoch !== state.sessionSearchEpoch ||
      workspace !== ports.workspace() ||
      query !== state.search
    )
      return;
    if (query) {
      state.sessionSearchItems = append
        ? [...state.sessionSearchItems, ...result.items]
        : result.items;
      state.sessionSearchBefore = result.before;
      state.sessionSearchQuery = query;
    } else {
      state.sessions = append
        ? [...state.sessions, ...result.items]
        : result.items;
      state.sessionIndexBefore = result.before;
    }
    ports.updateSessionResults();
  };
}
