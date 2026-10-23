import { inertSnapshot, effectOf } from "./contracts.js";
import type { MotionContext, MotionItem } from "./contracts.js";
import type { MotionEngine } from "./engine.js";
export function retainEditor(
  context: MotionContext,
  engine: MotionEngine,
  item: MotionItem,
) {
  engine.removeGhost("editor");
  const { element, rect, scrollTop } = item;
  if (!rect.width || !rect.height) return;
  let opacity = item.exitOpacity ?? 1;
  for (const [animation, target] of context.running)
    if (target === element) {
      const effect = effectOf(animation);
      const frames = effect?.getKeyframes?.();
      if (frames?.every((frame) => frame.opacity !== undefined))
        opacity = effect?.getComputedTiming().progress ?? 0;
    }
  engine.cancelTree(element);
  if (opacity <= 0.001) return;
  const host = context.document.createElement("div");
  host.className = "studio-dialog modes-dialog panel-mode-exit";
  inertSnapshot(host);
  Object.assign(host.style, {
    position: "fixed",
    left: rect.x + "px",
    top: rect.y + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    display: "block",
    padding: "0",
    margin: "0",
    border: "0",
    borderRadius: "0",
    boxShadow: "none",
    background: "transparent",
    overflow: "hidden",
    zIndex: "90",
  });
  host.style.filter = "blur(10px)";
  inertSnapshot(element);
  Object.assign(element.style, {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    paddingRight: item.paddingRight + item.scrollbarWidth + "px",
  });
  host.append(element);
  context.document.body.append(host);
  element.scrollTop = scrollTop;
  context.ghosts.set("editor", host);
  engine.animate(host, [{ filter: "blur(0px)" }, { filter: "blur(10px)" }], {
    duration: 220,
    easing: "ease-out",
  });
  engine.animate(
    host,
    [{ opacity }, { opacity: 0 }],
    { duration: 180, delay: 500, easing: "ease-out" },
    () => {
      if (context.ghosts.get("editor") === host) engine.removeGhost("editor");
      else host.remove();
    },
  );
}
