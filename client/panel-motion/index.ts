import { componentBrowser, reducedMotion } from "../components/browser.js";
import type { ComponentRoot, MotionOptions } from "../components/browser.js";
import type { MotionContext, MotionItem } from "./contracts.js";
import { motionEngine } from "./engine.js";
import { motionSprings } from "./springs.js";
import { refreshMotion } from "./refresh.js";
export function installPanelMotion(
  root: ComponentRoot = document,
  options: MotionOptions = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { window } = browser;
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let disposed = false,
    pending = false,
    initialized = false;
  let previous = new Map<string, MotionItem>();
  const context: MotionContext = {
    root,
    ...browser,
    running: new Map(),
    springs: new Map(),
    ghosts: new Map(),
    reduced: () => reducedMotion(window, options, media),
    schedule() {
      if (!pending && !disposed) {
        pending = true;
        queueMicrotask(refresh);
      }
    },
  };
  const engine = motionEngine(context);
  const springs = motionSprings(context);
  function refresh() {
    pending = false;
    if (disposed) return;
    previous = refreshMotion(context, engine, springs, previous, initialized);
    initialized = true;
  }
  const observer = new window.MutationObserver(context.schedule);
  observer.observe(root, { childList: true, subtree: true });
  const rememberScroll = (event: Event) => {
    for (const item of previous.values())
      if (item.type === "editor" && item.element === event.target)
        item.scrollTop = item.element.scrollTop;
  };
  root.addEventListener("scroll", rememberScroll, true);
  const onReduced = () => {
    if (context.reduced()) engine.clear();
  };
  media?.addEventListener?.("change", onReduced);
  refresh();
  return () => {
    disposed = true;
    observer.disconnect();
    root.removeEventListener("scroll", rememberScroll, true);
    media?.removeEventListener?.("change", onReduced);
    engine.clear();
    previous.clear();
  };
}
