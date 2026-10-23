import type { PanelSession } from "../panel/data.js";
import type { HistoryItem, HistoryKind } from "../history/view.js";
import type { HistoryDirection, HistoryPorts } from "./contracts.js";

export function createHistoryNavigation<Session extends PanelSession>(
  ports: HistoryPorts<Session>,
) {
  const navigation = new Set<string>();
  async function load(kind: HistoryKind) {
    const session = ports.state.current;
    const before = session?.history?.[kind]?.before;
    if (!session || !before) return;
    const workspace = ports.workspace();
    const limit = kind === "transcripts" ? 80 : kind === "captures" ? 30 : 20;
    const page = await ports.history(
      `/sessions/${session.id}/history/${kind}?limit=${limit}&before=${encodeURIComponent(before)}`,
    );
    const current = ports.state.current;
    if (
      current?.id !== session.id ||
      workspace !== ports.workspace() ||
      current.history?.[kind]?.before !== before
    )
      return;
    ports.state.current = ports.merge(current, kind, page);
  }
  async function move(
    kind: HistoryKind,
    view: string,
    direction: HistoryDirection,
  ) {
    const session = ports.state.current;
    if (!session) return;
    const workspace = ports.workspace();
    const token = workspace + "|" + session.id + "|" + view;
    if (navigation.has(token)) return;
    const focus = ports.focus();
    const options = {
      view,
      ...(kind === "responses" && view !== "overlay"
        ? {
            filter: (response: HistoryItem) => response.action !== "recap",
          }
        : {}),
    };
    navigation.add(token);
    try {
      let current = session;
      let page = ports.pager.move(current, kind, direction, options);
      let count = 0;
      while (page.needsOlder && count++ < 8) {
        const before = current.history?.[kind]?.before;
        await load(kind);
        const loaded = ports.state.current;
        if (loaded?.id !== session.id || ports.workspace() !== workspace)
          return;
        current = loaded;
        if (current.history?.[kind]?.before === before) break;
        page = ports.pager.move(current, kind, direction, options);
      }
      if (
        ports.state.current?.id === session.id &&
        workspace === ports.workspace()
      ) {
        const restore = focus?.current();
        ports.render();
        if (restore) focus?.restore();
        if (direction === "latest" && ports.view() === "overlay")
          ports.scrollAnswers();
      }
    } finally {
      navigation.delete(token);
    }
  }
  return { load, move };
}
