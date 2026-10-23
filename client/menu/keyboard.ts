import { focusMenu, menuItems } from "./contracts.js";
import type { MenuContext } from "./contracts.js";
import type { MenuActions } from "./actions.js";
import { recordFor, closedTrigger } from "./model.js";
const text = (item: HTMLElement) =>
  (item.getAttribute("aria-label") || item.textContent || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export function menuKeyboard(context: MenuContext, actions: MenuActions) {
  return (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !event.target
    )
      return;
    const target = event.target as HTMLElement;
    const record = recordFor(context, target);
    const trigger = closedTrigger(context, target);
    if (
      !record &&
      trigger &&
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      actions.open(trigger, event.key === "ArrowUp" ? "last" : "first");
      return;
    }
    if (!record) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      actions.close(record, { reason: "escape", returnFocus: true });
      return;
    }
    if (event.key === "Tab") {
      const candidates = [
        ...context.document.querySelectorAll<HTMLElement>(
          "button,a[href],input,textarea,select,summary,[tabindex]",
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !("disabled" in element && element.disabled) &&
          !element.hidden &&
          !element.closest("[inert],[data-motion-exit]") &&
          !record.popup.contains(element) &&
          (!element.getClientRects || element.getClientRects().length),
      );
      const index = candidates.indexOf(record.trigger);
      const delta = event.shiftKey ? -1 : 1;
      const next =
        candidates[(index + delta + candidates.length) % candidates.length];
      event.preventDefault();
      event.stopPropagation();
      actions.close(record, { reason: "tab" });
      next?.focus?.({ preventScroll: true });
      return;
    }
    const enabled = menuItems(record);
    const index = enabled.indexOf(
      context.document.activeElement as HTMLElement,
    );
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      focusMenu(
        record,
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? enabled.length - 1
            : index < 0
              ? event.key === "ArrowUp"
                ? enabled.length - 1
                : 0
              : index + (event.key === "ArrowUp" ? -1 : 1),
      );
      return;
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (record.trigger.contains(target)) focusMenu(record, 0);
      else enabled[Math.max(0, index)]?.click();
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      record.buffer =
        (now - record.bufferAt > 700 ? "" : record.buffer) +
        event.key
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase();
      record.bufferAt = now;
      const repeated = [...record.buffer].every(
        (character) => character === record.buffer[0],
      );
      const query = repeated ? record.buffer[0]! : record.buffer;
      for (let step = 1; step <= enabled.length; step++) {
        const candidate = (Math.max(-1, index) + step) % enabled.length;
        if (text(enabled[candidate]!).startsWith(query)) {
          focusMenu(record, candidate);
          break;
        }
      }
    }
  };
}
