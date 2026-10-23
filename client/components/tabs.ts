import { animateSpring } from "../motion/index.js";
import { componentBrowser, reducedMotion } from "./browser.js";
import type { ComponentRoot, MotionOptions } from "./browser.js";
import { tabKeyboard } from "./tab-keyboard.js";
type Tab = { key: string | undefined; rectangle: DOMRect; pill: HTMLElement };
export function installSessionTabs(
  root: ComponentRoot = document,
  options: MotionOptions = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { window } = browser;
  const reduced = () => reducedMotion(window, options);
  let previous = new Map<string | undefined, Tab>(),
    disposed = false,
    pending = false;
  const active = new Map<ReturnType<typeof animateSpring>, HTMLElement>();
  const cancel = () => {
    for (const handle of active.keys()) handle.cancel();
    active.clear();
  };
  function refresh() {
    pending = false;
    if (disposed) return;
    const next = new Map<string | undefined, Tab>();
    for (const navigation of root.querySelectorAll<HTMLElement>(
      "[data-session-tabs]",
    )) {
      if (navigation.closest("[data-motion-exit]")) continue;
      const button = navigation.querySelector<HTMLButtonElement>(
        '[data-detail-tab][aria-selected="true"]',
      );
      const pill = button?.querySelector<HTMLElement>(".session-tab-pill");
      if (!button || !pill) continue;
      const rectangle = button.getBoundingClientRect();
      const id = navigation.dataset.sessionTabs;
      const item = { key: button.dataset.detailTab, rectangle, pill };
      next.set(id, item);
      const old = previous.get(id);
      if (old && old.key !== item.key && rectangle.width > 0 && !reduced()) {
        cancel();
        const offset = old.rectangle.x - rectangle.x;
        const ratio = old.rectangle.width / rectangle.width;
        const handle = animateSpring(pill, {
          stiffness: 560,
          damping: 18,
          mass: 0.28,
          from: 1,
          to: 0,
          property: "transform",
          format: (value) =>
            `translateX(${offset * value}px) scaleX(${1 + (ratio - 1) * value})`,
          reducedMotion: reduced,
        });
        active.set(handle, pill);
        handle.finished.finally(() => active.delete(handle));
      }
    }
    for (const [handle, pill] of active)
      if (!pill.isConnected) {
        handle.cancel();
        active.delete(handle);
      }
    previous = next;
  }
  const schedule = () => {
    if (!disposed && !pending) {
      pending = true;
      queueMicrotask(refresh);
    }
  };
  const onKey = tabKeyboard(root, window, () => disposed);
  const observer = new window.MutationObserver(schedule);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected", "data-session-tabs"],
  });
  const onResize = () => {
    cancel();
    previous.clear();
    refresh();
  };
  window.addEventListener("resize", onResize);
  root.addEventListener("keydown", onKey, true);
  refresh();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    root.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    cancel();
    previous.clear();
  };
}
