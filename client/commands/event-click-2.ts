import {
  datasetValue,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopClick2(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const searchSession = target.closest<HTMLElement>("[data-search-session]"),
      searchPage = target.closest<HTMLElement>("[data-search-page]");
    if (searchSession) {
      ports.closeModal();
      await ports.activate(datasetValue(searchSession.dataset.searchSession));
    }
    if (searchPage) {
      ports.closeModal();
      const target = datasetValue(searchPage.dataset.searchPage);
      browser.accountOpen = false;
      if (target === "start") await ports.startSession(browser.selectedMode);
      else {
        if (searchPage.dataset.searchSettings) {
          browser.settingsTab = target;
          browser.page = "settings";
        } else browser.page = target;
        if (browser.page === "prompts")
          browser.modeEditor = browser.selectedMode;
        ports.render();
        if (browser.page === "settings" && browser.settingsTab === "general")
          await ports.loadDevices();
      }
    }
    if (target.matches("[data-dialog-backdrop]")) {
      browser.page = "home";
      ports.render();
    }
  });
}
