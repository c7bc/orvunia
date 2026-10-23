import { requireCommandSession } from "./model.js";

import type { CommandContext } from "./ports.js";
export async function runNavigationCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "overlay-more":
      browser.overlayMore = !browser.overlayMore;
      ports.render();
      return true;
    case "collapse-chat":
      ports.preparedReveal.cancel();
      browser.tab = "answers";
      browser.chatCollapsed = true;
      ports.render();
      return true;
    case "dialog-close":
      browser.accountOpen = false;
      browser.page = "home";
      ports.render();
      return true;
    case "account-menu":
      browser.accountOpen = !browser.accountOpen;
      ports.render();
      return true;
    case "account-retry":
      delete ports.accountMarkup[browser.settingsTab];
      ports.render();
      return true;
    case "calendar-open":
      browser.settingsTab = "calendar";
      browser.page = "settings";
      browser.accountOpen = false;
      ports.render();
      return true;
    case "refresh":
      await ports.sync();
      ports.render();
      return true;
    case "quick-start":
      if (browser.current && requireCommandSession(browser).state !== "ended") {
        if (ports.native) await ports.native.overlay();
        else {
          browser.view = "overlay";
          ports.render();
        }
        return true;
      }
      await ports.begin(
        browser.selectedMode,
        browser.profile?.company
          ? ports.modeName(browser.selectedMode) +
              " · " +
              browser.profile.company
          : ports.modeName(browser.selectedMode),
      );
      return true;
    case "open-assistant":
      if (browser.current?.state === "active") {
        if (ports.native) await ports.native.overlay();
        else {
          browser.view = "overlay";
          ports.render();
        }
      } else
        await ports.begin(
          browser.selectedMode,
          ports.modeName(browser.selectedMode),
        );
      return true;
    case "search-open":
      ports.searchDialog();
      return true;
    case "providers":
      browser.page = "settings";
      browser.settingsTab = "providers";
      ports.render();
      return true;
    case "context":
    case "settings":
    case "panel":
      if (browser.view !== "panel" && ports.native)
        await ports.native.panel(key === "panel" ? "home" : key);
      else {
        browser.view = "panel";
        browser.page = key === "panel" ? "home" : key;
        if (!ports.native)
          ports.window.history.replaceState(null, "", "/desktop.html");
        ports.render();
      }
      return true;
    case "new":
      ports.closeModal();
      if (browser.view !== "panel" && ports.native)
        await ports.native.panel("home");
      else {
        browser.page = "home";
        ports.render();
      }
      return true;
    case "profile":
      ports.modal("Perfil e vaga", ports.profileForm());
      return true;
    case "resume-current":
      ports.closeModal();
      if (ports.native) await ports.native.overlay();
      else {
        browser.view = "overlay";
        ports.render();
      }
      return true;
    case "toggle-overlay":
      ports.preparedReveal.cancel();
      if (ports.native) await ports.native.toggle();
      else {
        browser.view = "panel";
        browser.page = "home";
        ports.window.history.replaceState(null, "", "/desktop.html");
        ports.render();
      }
      return true;
  }
  return false;
}
