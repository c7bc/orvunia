import { requireCommandSession } from "./model.js";

import { element } from "./elements.js";
import {
  commandError,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopInput(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("input", (e) => {
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    if (target.id === "session-chat-question") {
      target.style.height = "40px";
      target.style.height =
        Math.min(80, Math.max(40, target.scrollHeight)) + "px";
      if (browser.current)
        ports.detailDrafts.set(requireCommandSession(browser).id, target.value);
      const send = ports.document.querySelector<HTMLButtonElement>(
        '[data-action="session-chat-send"]',
      );
      if (send) send.disabled = browser.busy || !target.value.trim();
    }
    if (target.id === "detail-question") {
      if (browser.current)
        ports.detailDrafts.set(requireCommandSession(browser).id, target.value);
      const send = ports.document.querySelector<HTMLButtonElement>(
        '[data-action="review-ask"]',
      );
      if (send) send.disabled = browser.busy || !target.value.trim();
    }
    if (target.id === "question") {
      browser.draft = target.value;
      ports.autosizeQuestion();
      ports.updateOverlaySize();
    }
    if (target.id === "session-search") {
      browser.search = target.value;
      ports.window.clearTimeout(browser.sessionSearchTimer ?? undefined);
      if (browser.search)
        browser.sessionSearchTimer = ports.window.setTimeout(
          () =>
            void ports
              .searchSessionHistory(browser.search)
              .catch((error) => ports.toast(commandError(error))),
          200,
        );
      else {
        browser.sessionSearchEpoch++;
        browser.sessionSearchQuery = "";
        browser.sessionSearchBefore = null;
      }
      element(context, "#session-results").innerHTML = ports.filteredSessions();
    }
    if (target.id === "command-search") ports.updateSearchResults(target.value);
  });
}
