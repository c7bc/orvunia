import { detailsSelector, menuBox } from "./contracts.js";
import type {
  MenuContext,
  MenuRecord,
  MenuTrigger,
  MenuKind,
} from "./contracts.js";
function record(
  value: Omit<MenuRecord, "index" | "buffer" | "bufferAt" | "focused" | "box">,
): MenuRecord {
  return {
    ...value,
    index: 0,
    buffer: "",
    bufferAt: 0,
    focused: false,
    box: menuBox(value.popup),
  };
}
export function describeDetails(owner: HTMLDetailsElement) {
  const trigger = owner.querySelector<HTMLElement>(":scope > summary");
  const popup = [...owner.children].find((child) => child !== trigger) as
    HTMLElement | undefined;
  if (!trigger || !popup) return null;
  const kind = owner.classList.contains("mode-options")
    ? "mode"
    : owner.classList.contains("summary-more")
      ? "summary"
      : owner.classList.contains("release-version-menu")
        ? "versions"
        : "format";
  const context =
    owner.closest<HTMLElement>("[data-motion-editor]")?.dataset.motionEditor ||
    owner.closest<HTMLElement>("[data-session-detail]")?.dataset
      .sessionDetail ||
    "panel";
  return record({
    owner,
    trigger,
    popup,
    details: true,
    kind,
    key: kind + ":" + context,
    open: owner.open,
    side: kind === "format" ? "top" : "bottom",
    action: undefined,
  });
}
export function gatherMenus(context: MenuContext) {
  const next = new Map<string, MenuRecord>();
  for (const owner of context.root.querySelectorAll<HTMLDetailsElement>(
    detailsSelector,
  )) {
    if (owner.closest("[data-motion-exit]")) continue;
    const record = describeDetails(owner);
    if (record) next.set(record.key, record);
  }
  for (const popup of context.root.querySelectorAll<HTMLElement>(
    ".dashboard-window > .account-menu,.dashboard-window .history-row-menu",
  )) {
    if (popup.closest("[data-motion-exit]")) continue;
    const kind: MenuKind = popup.classList.contains("history-row-menu")
      ? "history"
      : "account";
    const owner =
      kind === "history"
        ? popup.closest<HTMLElement>("[data-history-menu-root]")
        : popup.parentElement;
    const trigger =
      kind === "history"
        ? owner?.querySelector<HTMLElement>(".history-menu-trigger")
        : context.root.querySelector<HTMLElement>(
            '.dashboard-titlebar [data-action="account-menu"]',
          );
    if (!owner || !trigger) continue;
    const key =
      kind + ":" + (kind === "history" ? trigger.dataset.action : "panel");
    next.set(
      key,
      record({
        owner,
        trigger,
        popup,
        kind,
        details: false,
        key,
        action: trigger.dataset.action,
        open: true,
        side: popup.classList.contains("above") ? "top" : "bottom",
      }),
    );
  }
  return next;
}
export function recordFor(context: MenuContext, target: Node | null) {
  return [...context.records.values()].find(
    (record) =>
      record.open &&
      (record.popup.contains(target) || record.trigger.contains(target)),
  );
}
export function closedTrigger(
  context: MenuContext,
  target: HTMLElement,
): MenuTrigger | null | undefined {
  const summary = target.closest?.("summary");
  const parent = summary?.parentElement;
  if (parent?.matches(detailsSelector)) {
    const description = describeDetails(parent as HTMLDetailsElement);
    return description ? context.records.get(description.key) : null;
  }
  const trigger = target.closest<HTMLElement>(
    '.dashboard-titlebar [data-action="account-menu"],.history-menu-trigger',
  );
  if (!trigger) return null;
  const kind = trigger.classList.contains("history-menu-trigger")
    ? "history"
    : "account";
  return {
    trigger,
    kind,
    key: kind + ":" + (kind === "history" ? trigger.dataset.action : "panel"),
  };
}
