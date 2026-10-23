import { fieldValue } from "./elements.js";
import {
  commandError,
  datasetValue,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopClick(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const download = target.closest<HTMLElement>("[data-update-download]");
    if (download) {
      try {
        if (ports.native)
          await ports.native.openUpdate(
            datasetValue(download.dataset.updateDownload),
          );
        else
          ports.window.open(
            download.dataset.updateDownload,
            "_blank",
            "noopener,noreferrer",
          );
      } catch (error) {
        ports.toast(commandError(error));
      }
      return;
    }
    const el = target.closest<HTMLButtonElement>("button");
    if (!el || el.disabled) return;
    try {
      if (el.dataset.action) {
        if (el.dataset.action !== "overlay-more") browser.overlayMore = false;
        await ports.action(el.dataset.action);
      }
      if (el.dataset.page) {
        browser.page = el.dataset.page;
        browser.accountOpen = false;
        if (browser.page === "changelog")
          ports.window.localStorage.setItem("cadence-v3-news-dismissed", "1");
        if (browser.page === "prompts" || browser.page === "context")
          browser.modeEditor = browser.selectedMode;
        browser.search = "";
        await ports.sync();
        ports.render();
        if (
          browser.page === "settings" &&
          (browser.settingsTab === "audio" || browser.settingsTab === "general")
        )
          await ports.loadDevices();
      }
      if (el.dataset.start) await ports.startSession(el.dataset.start);
      if (el.dataset.session) await ports.activate(el.dataset.session);
      if (el.dataset.tab) {
        browser.overlayMore = false;
        browser.chatCollapsed = false;
        browser.draft = fieldValue(context, "#question") ?? browser.draft;
        browser.tab = el.dataset.tab;
        ports.render();
      }
      if (el.dataset.editMode) {
        browser.modeCatalog = false;
        ports.captureModeDraft();
        browser.modeEditor = el.dataset.editMode;
        ports.render();
      }
      if (el.dataset.releaseVersion) {
        browser.releaseVersion = el.dataset.releaseVersion;
        ports.render();
      }
      if (el.dataset.detailTab) {
        browser.detailTab = el.dataset.detailTab;
        ports.render();
      }
      if (el.dataset.settingsTab) {
        browser.settingsTab = el.dataset.settingsTab;
        ports.render();
        if (
          browser.settingsTab === "audio" ||
          browser.settingsTab === "general"
        )
          await ports.loadDevices();
      }
      if (el.dataset.quickQuestion) {
        browser.overlayMore = false;
        await ports.ask("custom", el.dataset.quickQuestion);
      }
      if (el.dataset.ask) {
        browser.overlayMore = false;
        browser.chatCollapsed = false;
        await ports.ask(el.dataset.ask);
      }
      if (el.dataset.custom) {
        browser.overlayMore = false;
        browser.chatCollapsed = false;
        const p = browser.library.prompts.find(
          (p) => p.id === el.dataset.custom,
        );
        if (!p) throw Error("Este prompt não está mais disponível.");
        await ports.ask("custom", p.instructions);
      }
      if (el.dataset.setting)
        await ports.setDesktop({
          [el.dataset.setting]: !browser.desktop.settings[el.dataset.setting],
        });
      if (el.dataset.source) {
        browser.source =
          ports.sources().find((s) => s.id === el.dataset.source) ?? null;
        if (!browser.source || !ports.native)
          throw Error("Esta fonte não está mais disponível.");
        await ports.native.source(browser.source.id);
        ports.closeModal();
        if (el.dataset.purpose === "audio") await ports.startAudio();
        else
          await ports.capture(
            browser.source.id,
            el.dataset.purpose === "capture-region",
          );
      }
    } catch (error) {
      ports.toast(commandError(error));
    }
  });
}
