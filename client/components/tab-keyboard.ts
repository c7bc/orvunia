import type { ComponentRoot } from "./browser.js";
export function tabKeyboard(
  root: ComponentRoot,
  window: Window,
  disposed: () => boolean,
) {
  return (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.defaultPrevented || key.altKey || key.ctrlKey || key.metaKey)
      return;
    const button = (
      event.target as HTMLElement | null
    )?.closest<HTMLButtonElement>("[data-session-tabs] [data-detail-tab]");
    if (
      !button ||
      !root.contains(button) ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(key.key)
    )
      return;
    const navigation = button.closest<HTMLElement>("[data-session-tabs]");
    if (!navigation) return;
    const buttons = [
      ...navigation.querySelectorAll<HTMLButtonElement>("[data-detail-tab]"),
    ].filter((item) => !item.disabled);
    const index = buttons.indexOf(button);
    const rtl = window.getComputedStyle(navigation).direction === "rtl";
    const direction = key.key === "ArrowRight" ? (rtl ? -1 : 1) : rtl ? 1 : -1;
    const target =
      key.key === "Home"
        ? buttons[0]
        : key.key === "End"
          ? buttons.at(-1)
          : buttons[(index + direction + buttons.length) % buttons.length];
    if (!target) return;
    key.preventDefault();
    key.stopPropagation();
    const session = navigation.dataset.sessionTabs;
    const tab = target.dataset.detailTab;
    target.click();
    queueMicrotask(() => {
      if (disposed()) return;
      const current = [
        ...root.querySelectorAll<HTMLElement>("[data-session-tabs]"),
      ].find((item) => item.dataset.sessionTabs === session);
      [
        ...(current?.querySelectorAll<HTMLButtonElement>("[data-detail-tab]") ??
          []),
      ]
        .find((item) => item.dataset.detailTab === tab)
        ?.focus?.({ preventScroll: true });
    });
  };
}
