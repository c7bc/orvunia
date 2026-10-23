import type { ApplicationState } from "./model.js";
import { audioStatusHeight } from "../audio-status/layout.js";
import { isOverlayExpanded } from "../overlay/expansion.js";
import { animateSpring, springState } from "../motion/index.js";
import {
  createSurfaceAnimator,
  createWindowTransition,
  createAssistantTransition,
  createMenuExit,
  autosizeOverlayQuestion,
} from "../overlay/index.js";

export function createApplicationLayout(ports: {
  state: ApplicationState;
  document: Document;
  window: Window;
  native: { layout(value: { height: number }): Promise<unknown> } | null;
  hasAttempt(sessionId: string): boolean;
  cancelPrepared(): void;
  toast(message: string): void;
}) {
  const { state, document, window } = ports;
  let disposed = false;
  const query = (selector: string) =>
    document.querySelector<HTMLElement>(selector);
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = createSurfaceAnimator(reducedMotion);
  const motion = createWindowTransition({
    target: () => ({
      view: state.view,
      element:
        state.view === "control"
          ? query(".control-shell")
          : state.view === "overlay"
            ? query(".assistant")
            : null,
    }),
    reducedMotion,
    beforeExit: ports.cancelPrepared,
    readStyle: (element) => window.getComputedStyle(element),
    spring: animateSpring,
    sample: springState,
    animate,
  });
  const menu = createMenuExit({
    document,
    reducedMotion,
    height: () => state.lastOverlayHeight,
    updateSize,
    animate,
  });
  const assistant = createAssistantTransition({
    document,
    state: () => ({
      view: state.view,
      tab: state.tab,
      expanded: !!query(".assistant.expanded"),
      menu: state.overlayMore,
    }),
    enter: () => motion.play("enter"),
    animate,
  });
  function updateSize() {
    if (disposed || state.view !== "overlay") return;
    if (state.layoutTimer !== null) return;
    state.layoutTimer = window.setTimeout(() => {
      state.layoutTimer = null;
      if (disposed || state.view !== "overlay") return;
      const expanded = isOverlayExpanded(state, Boolean(state.current && ports.hasAttempt(state.current.id)));
      const area = query("#answer-content"),
        extra = Math.max(
          0,
          (query("#question")?.getBoundingClientRect().height || 32) - 32,
        );
      const detached = document.documentElement.classList.contains("detached-surfaces");
      const base = state.auxiliaryModal && !detached
        ? 600
        : state.overlayMore && !detached
          ? 500
          : expanded
            ? Math.max(
                350,
                Math.min(600, (area?.scrollHeight || 200) + 168 + extra),
              )
            : (state.desktop.settings.protected ? 152 : 140) +
              extra +
              (state.current?.captures.length ? 22 : 0);
      const statusHeight = audioStatusHeight(query("[data-audio-status]"), element => window.getComputedStyle(element));
      const height = Math.min(720, Math.max(base + statusHeight, detached ? 0 : menu.height()));
      document.documentElement.style.setProperty(
        "--overlay-height",
        height + "px",
      );
      if (ports.native && height !== state.lastOverlayHeight) {
        state.lastOverlayHeight = height;
        void ports.native
          .layout({ height })
          .catch((error) =>
            ports.toast(
              error instanceof Error
                ? error.message
                : "Não foi possível ajustar a janela.",
            ),
          );
      }
    }, 40);
  }
  function autosize() {
    const field = document.querySelector<HTMLTextAreaElement>("#question");
    if (field) autosizeOverlayQuestion(field);
  }
  function theme() {
    document.documentElement.dataset.view = state.view;
    document.documentElement.style.setProperty(
      "--surface-alpha",
      String(
        Math.max(
          0.45,
          Math.min(1, (state.desktop.settings.opacity ?? 100) / 100),
        ),
      ),
    );
    document.body.className =
      (state.view === "panel"
        ? state.desktop.settings.theme === "dark" ||
          (state.desktop.settings.theme === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches)
          ? "dark-panel dark"
          : ""
        : state.view) +
      (!ports.native && state.view === "overlay"
        ? " browser-preview"
        : !ports.native && state.view === "control"
          ? " browser-control-preview"
          : "");
  }
  return {
    animate,
    motion,
    menu,
    assistant,
    updateSize,
    autosize,
    theme,
    reducedMotion,
    dispose() {
      disposed = true;
      if (state.layoutTimer !== null) window.clearTimeout(state.layoutTimer);
      state.layoutTimer = null;
      motion.dispose();
      menu.dispose();
    },
  };
}
