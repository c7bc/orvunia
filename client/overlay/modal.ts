import { escapeHtml } from "../design/html.js";
import { modalExit } from "./modal-exit.js";
import type { SurfaceAnimator } from "./animation.js";
export function createModalSurface(dependencies: {
  document: Document;
  animate: SurfaceAnimator;
  updateSize(): void;
  visual(element: HTMLElement | null): { opacity: number; scale: number };
  media: MediaQueryList;
}) {
  const document = dependencies.document;
  let returnFocus: Element | null = null,
    disposed = false;
  const exits = new Set<() => void>();
  const clearExits = () => {
    for (const finish of [...exits]) finish();
  };
  const reduced = (event: MediaQueryListEvent) => {
    if (!event.matches) return;
    clearExits();
    for (const element of document.querySelectorAll<HTMLElement>(
      "#dialogs :is(.modal-backdrop,.modal)",
    ))
      for (const animation of element.getAnimations?.() ?? [])
        animation.cancel();
  };
  dependencies.media.addEventListener("change", reduced);
  return {
    open(
      title: string,
      content: string,
      className: string,
      closeButton: string,
    ) {
      if (disposed) return;
      clearExits();
      const host = document.querySelector<HTMLElement>("#dialogs");
      if (!host) throw Error("Modal host is unavailable");
      const alreadyOpen = Boolean(host.querySelector(".modal"));
      if (!alreadyOpen) returnFocus = document.activeElement;
      host.innerHTML = `<div class="modal-backdrop"><section class="modal ${escapeHtml(className)}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><h2>${escapeHtml(title)}</h2>${closeButton}</div>${content}</section></div>`;
      if (!alreadyOpen)
        dependencies.animate(
          host.querySelector(".modal-backdrop"),
          [{ opacity: 0 }, { opacity: 1 }],
          100,
        );
      if (!alreadyOpen && !host.querySelector(".search-dialog"))
        dependencies.animate(
          host.querySelector(".modal"),
          [
            { opacity: 0, scale: ".95" },
            { opacity: 1, scale: "1" },
          ],
          100,
        );
      host
        .querySelector<HTMLElement>(".modal :is(input,textarea,select)")
        ?.focus();
    },
    close() {
      if (disposed) return;
      const host = document.querySelector<HTMLElement>("#dialogs");
      if (!host) return;
      const backdrop = host.querySelector<HTMLElement>(".modal-backdrop"),
        surface = host.querySelector<HTMLElement>(".modal");
      const externalExit = Boolean(host.querySelector(".search-dialog"));
      const visual = dependencies.visual(backdrop),
        surfaceVisual = dependencies.visual(surface);
      if (!externalExit)
        for (const element of [backdrop, surface])
          for (const animation of element?.getAnimations?.() ?? [])
            animation.cancel();
      host.replaceChildren();
      if (backdrop && !externalExit) {
        const exit = modalExit({
          backdrop,
          surface,
          visual,
          surfaceVisual,
          document,
          animate: dependencies.animate,
          done() {
            exits.delete(exit.finish);
            dependencies.updateSize();
          },
        });
        exits.add(exit.finish);
        if (!exit.animated) exit.finish();
      } else dependencies.updateSize();
      if (
        returnFocus?.isConnected &&
        "focus" in returnFocus &&
        typeof returnFocus.focus === "function"
      )
        returnFocus.focus();
      returnFocus = null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearExits();
      returnFocus = null;
      dependencies.media.removeEventListener("change", reduced);
    },
  };
}
