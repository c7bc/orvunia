import { menuBox } from "./contracts.js";
import type { MenuContext, MenuRecord } from "./contracts.js";
import type { MenuAnimation } from "./animation.js";
const properties = [
  "display",
  "padding",
  "margin",
  "gap",
  "border",
  "borderRadius",
  "backgroundColor",
  "color",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "alignItems",
  "justifyContent",
  "textAlign",
  "minHeight",
  "height",
  "boxShadow",
] as const;
export function retainMenu(
  context: MenuContext,
  animation: MenuAnimation,
  record: MenuRecord,
) {
  animation.clearExit(record.key);
  let opacity = 1;
  if (record.popup.isConnected) {
    record.box = menuBox(record.popup);
    const value = context.window.getComputedStyle?.(record.popup)?.opacity;
    if (value) opacity = Number(value);
  }
  animation.cancel(record.popup);
  if (
    context.reduced() ||
    opacity <= 0.001 ||
    !record.box.width ||
    record.popup.closest("[data-motion-exit]")
  )
    return;
  const snapshot = record.popup.cloneNode(true) as HTMLElement;
  const originals = [
    record.popup,
    ...record.popup.querySelectorAll<HTMLElement>("*"),
  ];
  const copies = [snapshot, ...snapshot.querySelectorAll<HTMLElement>("*")];
  originals.forEach((original, index) => {
    const style = context.window.getComputedStyle?.(original);
    if (style)
      for (const property of properties)
        copies[index]!.style[property] = style[property];
  });
  snapshot.inert = true;
  snapshot.dataset.motionExit = "menu";
  snapshot.dataset.panelMenuExit = "";
  snapshot.setAttribute("aria-hidden", "true");
  snapshot.removeAttribute("id");
  for (const child of snapshot.querySelectorAll("[id]"))
    child.removeAttribute("id");
  snapshot.classList.add("panel-menu-snapshot");
  Object.assign(snapshot.style, {
    position: "fixed",
    left: record.box.x + "px",
    top: record.box.y + "px",
    width: record.box.width + "px",
    height: record.box.height + "px",
    maxHeight: "none",
    maxWidth: "none",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "310",
    animation: "none",
    translate: "none",
    transformOrigin: record.side === "top" ? "bottom right" : "top right",
  });
  context.document.body.append(snapshot);
  context.exits.set(record.key, snapshot);
  animation.animate(
    snapshot,
    [
      { opacity, transform: "translateY(0) scale(1)" },
      {
        opacity: 0,
        transform: `translateY(${record.side === "top" ? 8 : -8}px) scale(.95)`,
      },
    ],
    () => {
      if (context.exits.get(record.key) === snapshot)
        animation.clearExit(record.key);
      else snapshot.remove();
    },
  );
}
