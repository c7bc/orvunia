import type { MotionContext, MotionItem } from "./contracts.js";
import { effectOf } from "./contracts.js";
import type { MotionEngine } from "./engine.js";
import type { MotionSprings } from "./springs.js";
import { motionSnapshots } from "./snapshots.js";
import { retainEditor } from "./editor.js";
import { selectMotion } from "./selection.js";
import { enterMotion } from "./entrance.js";
export function refreshMotion(
  context: MotionContext,
  engine: MotionEngine,
  springs: MotionSprings,
  previous: Map<string, MotionItem>,
  initialized: boolean,
) {
  const current = selectMotion(context, springs);
  const hasModes = current.has("dialog:modes");
  const snapshots = motionSnapshots(context, engine, springs);
  for (const [key, item] of previous)
    if (item.type === "editor" && !current.has(key)) {
      item.exitOpacity = 1;
      for (const [animation, target] of context.running)
        if (target === item.element) {
          const effect = effectOf(animation);
          if (
            effect
              ?.getKeyframes?.()
              .every((frame) => frame.opacity !== undefined)
          )
            item.exitOpacity = effect.getComputedTiming().progress ?? 0;
        }
    }
  const addedDialog = [...current].some(
    ([key, item]) => item.type === "dialog" && !previous.has(key),
  );
  if (addedDialog || !hasModes) engine.removeGhost("editor");
  if (addedDialog)
    for (const channel of [...context.ghosts.keys()])
      engine.removeGhost(channel);
  for (const [key, item] of current) {
    const old = previous.get(key);
    if (old) {
      if (old.element !== item.element) {
        if (["dialog", "search", "editor"].includes(item.type))
          engine.continueEntrance(old.element, item.element);
        engine.cancelTree(old.element);
      }
      continue;
    }
    enterMotion(item, initialized, engine, springs);
  }
  for (const [key, item] of previous) {
    if (current.has(key)) continue;
    const { type, element } = item;
    if (context.reduced() || type === "chat-control")
      engine.cancelTree(element);
    else if (type === "footer") {
      if (
        ![...current.values()].some((item) =>
          ["dialog", "footer"].includes(item.type),
        )
      )
        snapshots.footer(item);
      else engine.cancelTree(element);
    } else if (type === "editor") {
      if (
        hasModes &&
        [...current.values()].some((item) => item.type === "editor")
      )
        retainEditor(context, engine, item);
      else engine.cancelTree(element);
    } else if (type === "badge") {
      if (hasModes) snapshots.badge(item);
      else engine.cancelTree(element);
    } else if (["dialog", "search"].includes(type)) snapshots.surface(item);
  }
  return current;
}
