import { componentBrowser, reducedMotion } from "../components/browser.js";
import type { ComponentRoot } from "../components/browser.js";
import type { MenuContext, MenuOptions } from "./contracts.js";
import { menuAnimation } from "./animation.js";
import { menuActions } from "./actions.js";
import { menuKeyboard } from "./keyboard.js";
import { menuEvents } from "./events.js";
import { refreshMenus } from "./refresh.js";
export function installPanelMenus(
  root: ComponentRoot = document,
  options: MenuOptions = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { document, window } = browser;
  let disposed = false,
    scheduled = false,
    sequence = 0;
  const context: MenuContext = {
    root,
    ...browser,
    options,
    records: new Map(),
    animations: new Map(),
    exits: new Map(),
    pendingFocus: null,
    reduced: () => reducedMotion(window, options),
    schedule() {
      if (!scheduled && !disposed) {
        scheduled = true;
        queueMicrotask(context.refresh);
      }
    },
    refresh() {
      scheduled = false;
      if (!disposed) refreshMenus(context, animation, actions, identifier);
    },
  };
  function identifier() {
    let id: string;
    do {
      id = "panel-menu-" + ++sequence;
    } while (document.querySelector(`#${id},[aria-controls="${id}"]`));
    return id;
  }
  const animation = menuAnimation(context);
  const actions = menuActions(context, animation);
  const keyboard = menuKeyboard(context, actions);
  const events = menuEvents(context, actions);
  const observer = new window.MutationObserver(context.schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  document.addEventListener("keydown", keyboard, true);
  document.addEventListener("click", events.click);
  document.addEventListener("pointerdown", events.outside, true);
  document.addEventListener("focusin", events.focus, true);
  window.addEventListener("resize", events.resize);
  context.refresh();
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("keydown", keyboard, true);
    document.removeEventListener("click", events.click);
    document.removeEventListener("pointerdown", events.outside, true);
    document.removeEventListener("focusin", events.focus, true);
    window.removeEventListener("resize", events.resize);
    for (const item of context.animations.keys()) item.cancel();
    context.animations.clear();
    for (const key of [...context.exits.keys()]) animation.clearExit(key);
    for (const record of context.records.values()) {
      record.popup.removeAttribute("data-panel-menu-managed");
      record.popup.removeAttribute("data-panel-menu-open");
    }
    context.records.clear();
    context.pendingFocus = null;
  };
}
