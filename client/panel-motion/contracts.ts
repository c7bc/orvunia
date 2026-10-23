import type { ComponentRoot } from "../components/browser.js";
import type { SpringHandle } from "../motion/domain.js";
export type MotionItem = {
  type: "dialog" | "editor" | "badge" | "footer" | "chat-control" | "search";
  element: HTMLElement;
  rect: { x: number; y: number; width: number; height: number };
  scrollTop: number;
  scrollbarWidth: number;
  paddingRight: number;
  exitOpacity?: number;
};
export type MotionContext = {
  root: ComponentRoot;
  document: Document;
  window: Window & typeof globalThis;
  reduced(): boolean;
  schedule(): void;
  running: Map<Animation, HTMLElement>;
  springs: Map<SpringHandle, HTMLElement>;
  ghosts: Map<string, HTMLElement>;
};
export function inertSnapshot(element: HTMLElement) {
  element.dataset.motionExit = "";
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
  element.style.pointerEvents = "none";
  element.removeAttribute("id");
  for (const node of element.querySelectorAll("[id]"))
    node.removeAttribute("id");
}
export function effectOf(animation: Animation) {
  return animation.effect as KeyframeEffect | null;
}
