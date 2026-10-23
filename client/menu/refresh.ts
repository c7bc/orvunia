import { assignAttribute, menuBox, menuItems, focusMenu } from "./contracts.js";
import type { MenuContext } from "./contracts.js";
import type { MenuAnimation } from "./animation.js";
import type { MenuActions } from "./actions.js";
import { gatherMenus } from "./model.js";
import { fitMenu } from "./position.js";
import { retainMenu } from "./snapshot.js";
export function refreshMenus(
  context: MenuContext,
  animation: MenuAnimation,
  actions: MenuActions,
  identifier: () => string,
) {
  const next = gatherMenus(context);
  for (const [key, record] of next) {
    const old = context.records.get(key);
    if (old?.details && old.open && old.owner !== record.owner) {
      (record.owner as HTMLDetailsElement).open = true;
      record.open = true;
    }
    record.index = old?.index ?? 0;
    record.buffer = old?.buffer || "";
    record.bufferAt = old?.bufferAt || 0;
    record.focused = old?.focused || false;
    const id = old?.popup.id || record.popup.id || identifier();
    record.popup.id = id;
    assignAttribute(record.popup, "role", "menu");
    assignAttribute(record.popup, "tabindex", "-1");
    assignAttribute(record.popup, "data-panel-menu-managed", "");
    assignAttribute(record.trigger, "aria-haspopup", "menu");
    assignAttribute(record.trigger, "aria-controls", id);
    assignAttribute(record.trigger, "aria-expanded", record.open);
    for (const item of record.popup.querySelectorAll("button")) {
      assignAttribute(item, "role", "menuitem");
      item.tabIndex = -1;
    }
    const enabled = menuItems(record);
    if (enabled.length)
      enabled[Math.min(record.index, enabled.length - 1)]!.tabIndex = 0;
    if (record.open) {
      fitMenu(context, record);
      record.box = menuBox(record.popup);
      assignAttribute(record.popup, "data-panel-menu-open", "");
      if (!old?.open) {
        animation.clearExit(key);
        actions.closeOthers(key);
        record.popup.style.transformOrigin =
          record.side === "top" ? "bottom right" : "top right";
        animation.animate(record.popup, [
          {
            opacity: 0,
            transform: `translateY(${record.side === "top" ? 8 : -8}px) scale(.95)`,
          },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ]);
      } else if (old.popup !== record.popup) {
        animation.cancel(old.popup);
        if (
          record.focused &&
          (!context.document.activeElement ||
            context.document.activeElement === context.document.body)
        )
          queueMicrotask(() => focusMenu(record, record.index));
      }
    } else if (old?.open) {
      record.box = old.box;
      retainMenu(context, animation, old);
    }
    context.records.set(key, record);
  }
  for (const [key, record] of [...context.records])
    if (!next.has(key)) {
      if (record.open && !record.popup.closest("[data-motion-exit]"))
        retainMenu(context, animation, record);
      animation.cancel(record.popup);
      context.records.delete(key);
    }
  if (context.pendingFocus) {
    const record = context.records.get(context.pendingFocus.key);
    if (record?.open) {
      const edge = context.pendingFocus.edge;
      context.pendingFocus = null;
      focusMenu(record, edge === "last" ? menuItems(record).length - 1 : 0);
    }
  }
}
