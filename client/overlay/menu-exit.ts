import type { SurfaceAnimator } from "./animation.js";
export function createMenuExit(dependencies: {
  document: Document;
  reducedMotion(): boolean;
  height(): number;
  updateSize(): void;
  animate: SurfaceAnimator;
}) {
  let height = 0,
    disposed = false;
  const cleanups = new Set<() => void>();
  return {
    height: () => height,
    retain(
      menu: HTMLElement,
      rectangle: DOMRect,
      style: Pick<CSSStyleDeclaration, "opacity" | "transform">,
    ) {
      if (disposed || dependencies.reducedMotion()) return;
      height = Math.max(dependencies.height() || 500, height);
      menu.inert = true;
      menu.setAttribute("aria-hidden", "true");
      menu.dataset.overlayExit = "";
      for (const node of menu.querySelectorAll("[id]"))
        node.removeAttribute("id");
      Object.assign(menu.style, {
        position: "fixed",
        left: rectangle.left + "px",
        top: rectangle.top + "px",
        width: rectangle.width + "px",
        height: rectangle.height + "px",
        bottom: "auto",
        right: "auto",
        margin: "0",
        pointerEvents: "none",
        zIndex: "9999",
        transformOrigin: "bottom center",
        opacity: "0",
      });
      dependencies.document.body.append(menu);
      const animation = dependencies.animate(
        menu,
        [
          { opacity: style.opacity, transform: style.transform },
          { opacity: 0, transform: "translateY(8px) scale(.95)" },
        ],
        100,
      );
      let completed = false;
      const cleanup = () => {
        if (completed) return;
        completed = true;
        animation?.cancel();
        menu.remove();
        cleanups.delete(cleanup);
        if (!cleanups.size) height = 0;
        dependencies.updateSize();
      };
      cleanups.add(cleanup);
      if (animation) void animation.finished.catch(() => {}).finally(cleanup);
      else cleanup();
    },
    dispose() {
      disposed = true;
      for (const cleanup of [...cleanups]) cleanup();
    },
  };
}
