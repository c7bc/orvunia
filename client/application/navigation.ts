import type { ApplicationState } from "./model.js";
export function createApplicationNavigation(ports: {
  state: ApplicationState;
  render(): void;
}) {
  const { state } = ports;
  function remember() {
    if (state.view !== "panel" || state.restoringNavigation) return;
    const entry = {
      page: state.page,
      settingsTab: state.settingsTab,
      modeEditor: state.modeEditor,
      detailTab: state.detailTab,
      session: state.page === "detail" ? state.current?.id : null,
    };
    const key =
      entry.page +
      ":" +
      (entry.page === "settings"
        ? entry.settingsTab
        : ["prompts", "context"].includes(entry.page)
          ? entry.modeEditor + ":" + state.modeCatalog
          : entry.page === "detail"
            ? entry.session + ":" + entry.detailTab
            : "");
    if (state.navigationTrail[state.navigationIndex]?.key === key) return;
    state.navigationTrail.splice(state.navigationIndex + 1);
    state.navigationTrail.push({
      ...entry,
      modeCatalog: state.modeCatalog,
      key,
    });
    if (state.navigationTrail.length > 50) state.navigationTrail.shift();
    state.navigationIndex = state.navigationTrail.length - 1;
  }
  async function navigate(direction: number) {
    const next = state.navigationIndex + direction,
      target = state.navigationTrail[next];
    if (!target) return;
    if (
      target.session &&
      !state.sessions.some((item) => item.id === target.session)
    ) {
      state.navigationTrail.splice(next, 1);
      return;
    }
    state.navigationIndex = next;
    state.page = target.page;
    state.settingsTab = target.settingsTab;
    state.modeEditor = target.modeEditor;
    state.detailTab = target.detailTab;
    state.modeCatalog = target.modeCatalog;
    if (target.session)
      state.current =
        state.sessions.find((item) => item.id === target.session) || null;
    state.historyMenuId = null;
    state.accountOpen = false;
    state.restoringNavigation = true;
    try {
      ports.render();
    } finally {
      state.restoringNavigation = false;
    }
  }
  return { remember, navigate };
}
