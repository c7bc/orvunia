import type { ComponentRoot, MotionOptions } from "../components/browser.js";
export type MenuKind =
  "account" | "history" | "mode" | "summary" | "versions" | "format";
export type MenuOptions = MotionOptions & {
  easing?: string;
  onRequestClose?(event: {
    kind: MenuKind;
    reason: string;
    returnFocus: boolean;
  }): void;
};
export type MenuBox = { x: number; y: number; width: number; height: number };
export type MenuRecord = {
  owner: HTMLElement;
  trigger: HTMLElement;
  popup: HTMLElement;
  details: boolean;
  kind: MenuKind;
  key: string;
  open: boolean;
  side: "top" | "bottom";
  action: string | undefined;
  index: number;
  buffer: string;
  bufferAt: number;
  focused: boolean;
  box: MenuBox;
};
export type MenuTrigger = Pick<MenuRecord, "trigger" | "kind" | "key"> &
  Partial<Pick<MenuRecord, "details" | "owner">>;
export type MenuContext = {
  root: ComponentRoot;
  document: Document;
  window: Window & typeof globalThis;
  options: MenuOptions;
  records: Map<string, MenuRecord>;
  animations: Map<Animation, HTMLElement>;
  exits: Map<string, HTMLElement>;
  pendingFocus: { key: string; edge: "first" | "last" } | null;
  reduced(): boolean;
  schedule(): void;
  refresh(): void;
};
export const detailsSelector =
  ".mode-options,.summary-more,.release-version-menu,.prompt-format-tools";
export function assignAttribute(
  element: HTMLElement,
  key: string,
  value: string | boolean,
) {
  if (element.getAttribute(key) !== String(value))
    element.setAttribute(key, String(value));
}
export function menuBox(element: HTMLElement): MenuBox {
  const rectangle = element.getBoundingClientRect?.();
  return {
    x: rectangle?.x || 0,
    y: rectangle?.y || 0,
    width: rectangle?.width || 0,
    height: rectangle?.height || 0,
  };
}
export function menuItems(record: MenuRecord) {
  return [
    ...record.popup.querySelectorAll<HTMLElement>('button,[role="menuitem"]'),
  ].filter(
    (item) =>
      !("disabled" in item && item.disabled) &&
      item.getAttribute("aria-disabled") !== "true" &&
      !item.hidden,
  );
}
export function focusMenu(record: MenuRecord, index: number) {
  const enabled = menuItems(record);
  if (!enabled.length) {
    record.popup.focus?.({ preventScroll: true });
    return;
  }
  index = (index + enabled.length) % enabled.length;
  for (const item of enabled) item.tabIndex = -1;
  enabled[index]!.tabIndex = 0;
  record.index = index;
  record.focused = true;
  enabled[index]!.focus?.({ preventScroll: true });
}
