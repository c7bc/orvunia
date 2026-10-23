import { element, optional, elements } from "./elements.js";
import {
  datasetValue,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopKeydown(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("keydown", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.matches?.("input[data-session-title]") && e.key === "Enter") {
      e.preventDefault();
      await ports.saveSessionTitle(target as HTMLInputElement);
      return;
    }
    if (
      browser.view === "overlay" &&
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      ["1", "2", "3"].includes(e.key) &&
      !optional(context, "#dialogs .modal")
    ) {
      e.preventDefault();
      browser.tab = (
        { 1: "answers", 2: "transcripts", 3: "context" } as Record<
          string,
          string
        >
      )[e.key]!;
      browser.chatCollapsed = false;
      ports.render();
      return;
    }
    if (
      browser.view === "overlay" &&
      browser.current?.mode === "technical" &&
      (e.ctrlKey || e.metaKey) &&
      !e.altKey &&
      e.key.toLowerCase() === "g" &&
      !optional(context, "#dialogs .modal")
    ) {
      e.preventDefault();
      ports.clearDialog();
      return;
    }
    if (e.key === "Tab" && optional(context, "#dialogs [role=dialog]")) {
      const items = elements(
        context,
        "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]",
        optional(context, "#dialogs [role=dialog]"),
      ).filter((el) => el.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && ports.document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && ports.document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (
      target.id === "command-search" &&
      ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
      const items = elements(context, "#command-results button"),
        selected = items.findIndex((b) =>
          b.classList.contains("command-selected"),
        );
      if (e.key === "Enter") {
        items[Math.max(0, selected)]?.click();
        return;
      }
      const next =
        (selected + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
        items.length;
      items.forEach((b, i) =>
        b.classList.toggle("command-selected", i === next),
      );
      items[next]?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (
      ["detail-question", "session-chat-question"].includes(target.id) &&
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      await ports.reviewAsk("#" + target.id);
      return;
    }
    if (target.dataset.shortcut) {
      if (e.key === "Tab") return;
      if (e.key === "Escape") {
        target.blur();
        return;
      }
      e.preventDefault();
      if (!ports.native) return;
      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push("CommandOrControl");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      const key =
        {
          ArrowUp: "Up",
          ArrowDown: "Down",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          " ": "Space",
        }[e.key] || e.key;
      if (["Control", "Shift", "Alt", "Meta"].includes(key)) return;
      keys.push(key.length === 1 ? key.toUpperCase() : key);
      if (keys.length < 2) {
        ports.toast("Use uma combinação com Ctrl, Alt ou Shift.");
        return;
      }
      await ports.setDesktop({
        shortcuts: { [datasetValue(target.dataset.shortcut)]: keys.join("+") },
      });
      return;
    }
    if (e.key === "Escape") {
      if (browser.overlayMore) {
        browser.overlayMore = false;
        ports.render();
        return;
      }
      if (element(context, "#dialogs").children.length) ports.closeModal();
      else if (
        browser.view === "overlay" &&
        browser.activeAnswerRequest?.sessionId === browser.current?.id
      )
        browser.controller?.abort();
      else if (["settings", "prompts", "context"].includes(browser.page)) {
        browser.page = "home";
        ports.render();
      }
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "k" &&
      browser.view === "panel"
    ) {
      e.preventDefault();
      ports.searchDialog();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !ports.native) {
      e.preventDefault();
      void ports.ask("assist");
    }
  });
}
