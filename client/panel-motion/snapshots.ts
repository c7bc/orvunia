import { popupVisualState } from "../motion/index.js";
import { inertSnapshot } from "./contracts.js";
import type { MotionContext, MotionItem } from "./contracts.js";
import type { MotionEngine } from "./engine.js";
import type { MotionSprings } from "./springs.js";
export function motionSnapshots(
  context: MotionContext,
  engine: MotionEngine,
  springs: MotionSprings,
) {
  function footer(item: MotionItem) {
    engine.removeGhost("footer");
    const { element, rect } = item;
    const opacity = Math.max(
      0,
      Math.min(1, springs.value(element, "opacity", 1)),
    );
    const y = springs.value(element, "transform", 0);
    engine.cancelTree(element);
    if (!rect.width || !rect.height || opacity < 0.001) return;
    const clone = element.cloneNode(true) as HTMLElement;
    inertSnapshot(clone);
    clone.classList.add("panel-footer-exit");
    Object.assign(clone.style, {
      position: "fixed",
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      maxWidth: "none",
      margin: "0",
      zIndex: "90",
    });
    context.ghosts.set("footer", clone);
    context.document.body.append(clone);
    springs.footer(clone, y, 10, opacity, 0).finally(() => {
      if (context.ghosts.get("footer") === clone) engine.removeGhost("footer");
      else clone.remove();
    });
  }
  function badge(item: MotionItem) {
    engine.removeGhost("badge");
    const { element, rect } = item;
    engine.cancelTree(element);
    const clone = element.cloneNode(true) as HTMLElement;
    inertSnapshot(clone);
    Object.assign(clone.style, {
      position: "fixed",
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      margin: "0",
      zIndex: "90",
    });
    context.ghosts.set("badge", clone);
    context.document.body.append(clone);
    springs.scale(clone, 1, 0.7);
    engine.animate(
      clone,
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 160, easing: "ease-out" },
      () => {
        if (context.ghosts.get("badge") === clone) engine.removeGhost("badge");
        else clone.remove();
      },
    );
  }
  function surface(item: MotionItem) {
    const { type, element } = item;
    const ghost =
      type === "search"
        ? element.closest<HTMLElement>(".modal-backdrop")
        : element;
    if (!ghost || ghost.isConnected) return;
    const surface =
      type === "search"
        ? element
        : element.querySelector<HTMLElement>(".studio-dialog");
    const owned = [...context.running.keys()];
    const visual = popupVisualState(ghost, owned);
    const surfaceVisual = surface ? popupVisualState(surface, owned) : null;
    engine.cancelTree(ghost);
    const channel = type + ":exit";
    engine.removeGhost(channel);
    inertSnapshot(ghost);
    context.ghosts.set(channel, ghost);
    context.document.body.append(ghost);
    const timing = { duration: 100, easing: "cubic-bezier(.4,0,.2,1)" };
    if (surface && surfaceVisual)
      engine.animate(
        surface,
        [
          {
            opacity: surfaceVisual.opacity,
            scale: String(surfaceVisual.scale),
          },
          { opacity: 0, scale: ".95" },
        ],
        timing,
      );
    engine.animate(
      ghost,
      [{ opacity: visual.opacity }, { opacity: 0 }],
      timing,
      () => {
        if (context.ghosts.get(channel) === ghost) engine.removeGhost(channel);
        else ghost.remove();
      },
    );
  }
  return { footer, badge, surface };
}
