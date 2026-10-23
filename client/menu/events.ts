import { detailsSelector, menuItems } from "./contracts.js";
import type { MenuContext } from "./contracts.js";
import type { MenuActions } from "./actions.js";
import { describeDetails, recordFor } from "./model.js";
export function menuEvents(context: MenuContext, actions: MenuActions) {
  const click = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const details = target.closest?.("summary")?.parentElement;
    if (
      details?.matches(detailsSelector) &&
      !details.closest("[data-motion-exit]")
    ) {
      const description = describeDetails(details as HTMLDetailsElement);
      const record = description ? context.records.get(description.key) : null;
      if (!record) return;
      event.preventDefault();
      if (record.open) actions.close(record, { reason: "trigger" });
      else {
        actions.closeOthers(record.key);
        (details as HTMLDetailsElement).open = true;
        context.refresh();
      }
      return;
    }
    const record = recordFor(context, target);
    if (
      record &&
      record.popup.contains(target) &&
      target.closest?.('[role="menuitem"]')
    )
      actions.close(record, { reason: "action", returnFocus: true });
  };
  const outside = (event: Event) => {
    const target = event.target as Node | null;
    for (const record of context.records.values())
      if (
        record.open &&
        !record.popup.contains(target) &&
        !record.trigger.contains(target)
      )
        actions.close(record, {
          reason:
            event.type === "focusin" ? "focus-outside" : "pointer-outside",
        });
  };
  const focus = (event: FocusEvent) => {
    const record = recordFor(context, event.target as Node | null);
    if (record && record.popup.contains(event.target as Node | null)) {
      record.focused = true;
      record.index = menuItems(record).indexOf(event.target as HTMLElement);
    }
    outside(event);
  };
  const resize = () => {
    for (const record of context.records.values())
      actions.close(record, { reason: "resize" });
  };
  return { click, outside, focus, resize };
}
