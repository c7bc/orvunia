import type { MotionContext, MotionItem } from "./contracts.js";
import type { MotionSprings } from "./springs.js";
export function selectMotion(context: MotionContext, springs: MotionSprings) {
  const items = new Map<string, MotionItem>();
  for (const element of context.root.querySelectorAll<HTMLElement>(
    "[data-motion-dialog],[data-motion-editor],[data-motion-badge],[data-motion-footer],[data-motion-chat-control],.search-dialog",
  )) {
    if (element.closest("[data-motion-exit]")) continue;
    const type = element.hasAttribute("data-motion-dialog")
      ? "dialog"
      : element.hasAttribute("data-motion-editor")
        ? "editor"
        : element.hasAttribute("data-motion-badge")
          ? "badge"
          : element.hasAttribute("data-motion-footer")
            ? "footer"
            : element.hasAttribute("data-motion-chat-control")
              ? "chat-control"
              : "search";
    const id =
      element.dataset.motionDialog ??
      element.dataset.motionEditor ??
      element.dataset.motionBadge ??
      element.dataset.motionFooter ??
      element.dataset.motionChatControl ??
      "search";
    const rectangle = element.getBoundingClientRect();
    items.set(type + ":" + id, {
      type,
      element,
      rect: {
        x: rectangle.x,
        y:
          type === "footer"
            ? rectangle.y - springs.value(element, "transform", 0)
            : rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
      },
      scrollTop: element.scrollTop,
      scrollbarWidth:
        type === "editor" ? element.offsetWidth - element.clientWidth : 0,
      paddingRight:
        type === "editor"
          ? parseFloat(context.window.getComputedStyle(element).paddingRight) ||
            0
          : 0,
    });
  }
  return items;
}
