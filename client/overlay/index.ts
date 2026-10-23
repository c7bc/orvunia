import { componentBrowser } from "../components/browser.js";
import type { ComponentRoot } from "../components/browser.js";
import { overlayPopupGeometry } from "./geometry.js";
export { overlayPopupGeometry, autosizeOverlayQuestion } from "./geometry.js";
export { createWindowTransition } from "./window-transition.js";
export { createSurfaceAnimator } from "./animation.js";
export { createAssistantTransition } from "./assistant-transition.js";
export { createMenuExit } from "./menu-exit.js";
export { createModalSurface } from "./modal.js";
export function installOverlayLayout(root: ComponentRoot = document) {
  const browser = componentBrowser(root);
  if (!browser) return { refresh() {}, dispose() {} };
  const { document, window } = browser;
  const entries = new Map<HTMLElement, { composer: HTMLElement }>();
  let frame: number | null = null,
    disposed = false,
    sequence = 0;
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const property = (element: HTMLElement, name: string, value: string) => {
    if (element.style.getPropertyValue(name) !== value)
      element.style.setProperty(name, value);
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = request(refresh);
  };
  const observer = window.ResizeObserver
    ? new window.ResizeObserver(schedule)
    : null;
  function identifier() {
    let id: string;
    do {
      id = `assistant-options-${++sequence}`;
    } while (document.getElementById(id));
    return id;
  }
  function refresh() {
    frame = null;
    if (disposed) return;
    const shells = new Set(root.querySelectorAll<HTMLElement>(".assistant"));
    for (const [shell, entry] of entries) {
      if (shells.has(shell)) continue;
      observer?.unobserve(shell);
      observer?.unobserve(entry.composer);
      entries.delete(shell);
    }
    for (const shell of shells) {
      const composer = shell.querySelector<HTMLElement>(".composer-wrap");
      if (!composer) continue;
      if (entries.get(shell)?.composer !== composer) {
        const previous = entries.get(shell);
        if (previous) observer?.unobserve(previous.composer);
        entries.set(shell, { composer });
        observer?.observe(shell);
        observer?.observe(composer);
      }
      const bounds = shell.getBoundingClientRect();
      const style = window.getComputedStyle(shell);
      const geometry = overlayPopupGeometry(
        {
          top: bounds.top + (parseFloat(style.borderTopWidth) || 0),
          bottom: bounds.bottom - (parseFloat(style.borderBottomWidth) || 0),
        },
        composer.getBoundingClientRect(),
      );
      property(shell, "--overlay-menu-bottom", `${geometry.bottom}px`);
      property(shell, "--overlay-menu-available", `${geometry.maxHeight}px`);
      const menu = [...shell.children].find((element) =>
        element.matches(".overlay-menu:not([aria-hidden=true])"),
      );
      if (menu && !menu.id) menu.id = identifier();
      for (const button of shell.querySelectorAll(
        '[data-action="overlay-more"]',
      )) {
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", String(Boolean(menu)));
        if (menu) button.setAttribute("aria-controls", menu.id);
        else button.removeAttribute("aria-controls");
      }
    }
  }
  const mutations = new window.MutationObserver(schedule);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("resize", schedule);
  document.fonts?.addEventListener("loadingdone", schedule);
  refresh();
  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== null) cancel(frame);
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
      for (const shell of entries.keys()) {
        shell.style.removeProperty("--overlay-menu-bottom");
        shell.style.removeProperty("--overlay-menu-available");
      }
      entries.clear();
    },
  };
}
