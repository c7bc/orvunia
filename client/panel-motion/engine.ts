import type { MotionContext } from "./contracts.js";
import { effectOf } from "./contracts.js";
export function motionEngine(context: MotionContext) {
  function animate(
    element: HTMLElement,
    frames: Keyframe[],
    timing: KeyframeAnimationOptions,
    finish?: () => void,
  ) {
    if (context.reduced() || !element.animate) {
      finish?.();
      return null;
    }
    const animation = element.animate(frames, { ...timing, fill: "both" });
    context.running.set(animation, element);
    animation.finished
      .catch(() => {})
      .finally(() => {
        context.running.delete(animation);
        animation.cancel();
        finish?.();
        context.schedule();
      });
    return animation;
  }
  function cancelTree(element: HTMLElement) {
    for (const [animation, target] of context.running)
      if (target === element || element.contains(target)) {
        context.running.delete(animation);
        animation.cancel();
      }
    for (const [handle, target] of context.springs)
      if (target === element || element.contains(target)) {
        context.springs.delete(handle);
        handle.cancel();
      }
  }
  function continueEntrance(oldElement: HTMLElement, newElement: HTMLElement) {
    if (context.reduced()) return;
    for (const [animation, target] of [...context.running]) {
      let replacement: HTMLElement | null = null;
      if (target === oldElement) replacement = newElement;
      else if (target === oldElement.querySelector(".studio-dialog"))
        replacement = newElement.querySelector(".studio-dialog");
      if (!replacement || animation.playState === "finished") continue;
      const time = animation.currentTime;
      const effect = effectOf(animation);
      const frames = effect?.getKeyframes?.();
      const timing = effect?.getTiming?.();
      if (!frames?.length || !timing || time == null) continue;
      const resumed = animate(replacement, frames, timing);
      if (resumed) resumed.currentTime = time;
    }
  }
  function removeGhost(channel: string) {
    const ghost = context.ghosts.get(channel);
    if (!ghost) return;
    context.ghosts.delete(channel);
    cancelTree(ghost);
    ghost.remove();
  }
  function clear() {
    for (const animation of context.running.keys()) animation.cancel();
    context.running.clear();
    for (const handle of context.springs.keys()) handle.cancel();
    context.springs.clear();
    for (const channel of [...context.ghosts.keys()]) removeGhost(channel);
  }
  return { animate, cancelTree, continueEntrance, removeGhost, clear };
}
export type MotionEngine = ReturnType<typeof motionEngine>;
