import type { MenuContext } from "./contracts.js";
export function menuAnimation(context: MenuContext) {
  function cancel(element: HTMLElement) {
    for (const [animation, target] of context.animations)
      if (target === element) {
        context.animations.delete(animation);
        animation.cancel();
      }
  }
  function clearExit(key: string) {
    const node = context.exits.get(key);
    if (!node) return;
    context.exits.delete(key);
    cancel(node);
    node.remove();
  }
  function animate(
    element: HTMLElement,
    frames: Keyframe[],
    finish?: () => void,
  ) {
    if (context.reduced() || !element.animate) {
      finish?.();
      return;
    }
    const animation = element.animate(frames, {
      duration: 100,
      easing: context.options.easing || "ease",
      fill: "both",
    });
    context.animations.set(animation, element);
    animation.finished
      .catch(() => {})
      .finally(() => {
        context.animations.delete(animation);
        animation.cancel();
        finish?.();
        context.schedule();
      });
  }
  return { cancel, clearExit, animate };
}
export type MenuAnimation = ReturnType<typeof menuAnimation>;
