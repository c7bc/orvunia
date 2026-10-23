import { assignAttribute } from "./contracts.js";
import type { MenuContext, MenuRecord, MenuTrigger } from "./contracts.js";
import type { MenuAnimation } from "./animation.js";
import { retainMenu } from "./snapshot.js";
export function menuActions(context: MenuContext, animation: MenuAnimation) {
  function findTrigger(record: MenuRecord) {
    if (record.trigger.isConnected) return record.trigger;
    if (record.kind === "account")
      return context.root.querySelector<HTMLElement>(
        '.dashboard-titlebar [data-action="account-menu"]',
      );
    if (record.kind === "history")
      return [
        ...context.root.querySelectorAll<HTMLElement>(".history-menu-trigger"),
      ].find((button) => button.dataset.action === record.action);
    return context.records.get(record.key)?.trigger;
  }
  function close(
    record: MenuRecord,
    { reason = "dismiss", returnFocus = false, snapshot = true } = {},
  ) {
    if (!record.open) return;
    if (snapshot) retainMenu(context, animation, record);
    else animation.cancel(record.popup);
    record.open = false;
    record.buffer = "";
    record.bufferAt = 0;
    assignAttribute(record.trigger, "aria-expanded", "false");
    record.popup.removeAttribute("data-panel-menu-open");
    if (record.details) (record.owner as HTMLDetailsElement).open = false;
    else {
      record.popup.remove();
      record.owner.classList.remove("menu-active");
      context.options.onRequestClose?.({
        kind: record.kind,
        reason,
        returnFocus,
      });
    }
    if (returnFocus) findTrigger(record)?.focus?.({ preventScroll: true });
  }
  function closeOthers(key: string) {
    for (const record of context.records.values())
      if (record.open && record.key !== key)
        close(record, { reason: "another-menu" });
  }
  function open(record: MenuTrigger, edge: "first" | "last") {
    context.pendingFocus = { key: record.key, edge };
    closeOthers(record.key);
    if (record.details && record.owner) {
      (record.owner as HTMLDetailsElement).open = true;
      context.refresh();
    } else record.trigger.click();
  }
  return { close, closeOthers, open };
}
export type MenuActions = ReturnType<typeof menuActions>;
