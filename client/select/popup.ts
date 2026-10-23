import type {
  SelectActions,
  SelectContext,
  SelectRecord,
} from "./contracts.js";
import { synchronize, validIndexes } from "./options.js";
import { positionPopup } from "./position.js";
import { popupItems } from "./items.js";
export function selectPopup(context: SelectContext): SelectActions {
  const clerk = context.options.motion === "clerk";
  function close({ focus = false, animate = true } = {}) {
    if (!context.current) return;
    const { record, popup } = context.current;
    context.current = null;
    record.button.setAttribute("aria-expanded", "false");
    record.button.removeAttribute("aria-activedescendant");
    popup.inert = true;
    popup.setAttribute("aria-hidden", "true");
    popup.removeAttribute("id");
    for (const item of popup.querySelectorAll("[id]"))
      item.removeAttribute("id");
    popup.style.pointerEvents = "none";
    if (animate && !context.reduced() && popup.animate) {
      const animation = popup.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          {
            opacity: 0,
            transform: clerk
              ? "translateY(-6px) scale(1)"
              : "translateY(-8px) scale(.95)",
          },
        ],
        {
          duration: clerk ? 280 : 100,
          easing: clerk
            ? "cubic-bezier(.16,1,.3,1)"
            : "cubic-bezier(.4,0,.2,1)",
        },
      );
      context.exits.add(popup);
      animation.finished
        .catch(() => {})
        .finally(() => {
          context.exits.delete(popup);
          popup.remove();
        });
    } else popup.remove();
    if (focus && record.button.isConnected)
      record.button.focus({ preventScroll: true });
  }
  function highlight(index: number) {
    if (!context.current) return;
    context.current.index = index;
    for (const item of context.current.popup.querySelectorAll<HTMLElement>(
      '[role="option"]',
    ))
      item.classList.toggle(
        "highlighted",
        Number(item.dataset.index) === index,
      );
    const active = context.current.popup.querySelector<HTMLElement>(
      `[data-index="${index}"]`,
    );
    if (active) {
      context.current.record.button.setAttribute(
        "aria-activedescendant",
        active.id,
      );
      const popup = context.current.popup;
      if (active.offsetTop < popup.scrollTop) popup.scrollTop = active.offsetTop;
      else if (active.offsetTop + active.offsetHeight > popup.scrollTop + popup.clientHeight)
        popup.scrollTop = active.offsetTop + active.offsetHeight - popup.clientHeight;
    }
  }
  function choose(index: number, { focus = true } = {}) {
    if (!context.current) return;
    const record = context.current.record;
    if (!record.select.options[index] || !validIndexes(record).includes(index))
      return;
    const changed = record.select.selectedIndex !== index;
    record.select.selectedIndex = index;
    close({ focus });
    synchronize(record);
    if (changed)
      record.select.dispatchEvent(
        new context.window.Event("change", { bubbles: true }),
      );
  }
  function open(record: SelectRecord) {
    if (record.select.disabled) return;
    close({ animate: false });
    const popup = context.document.createElement("div");
    popup.className = "flow-select-popup";
    if (context.options.popupClassName)
      popup.classList.add(
        ...String(context.options.popupClassName).split(/\s+/).filter(Boolean),
      );
    if (clerk) popup.classList.add("flow-select-popup-clerk");
    popup.id = record.id;
    popup.role = "listbox";
    popup.setAttribute(
      "aria-label",
      record.select.getAttribute("aria-label") || "",
    );
    popupItems(context, record, popup, actions);
    context.document.body.append(popup);
    const anchor = record.button.getBoundingClientRect();
    context.current = { record, popup, index: record.select.selectedIndex,
      anchor: { top: anchor.top, left: anchor.left } };
    positionPopup(context, record, popup);
    record.button.setAttribute("aria-expanded", "true");
    const enabled = validIndexes(record);
    highlight(
      enabled.includes(record.select.selectedIndex)
        ? record.select.selectedIndex
        : (enabled[0] ?? -1),
    );
  }
  const actions = { close, highlight, choose, open };
  return actions;
}
