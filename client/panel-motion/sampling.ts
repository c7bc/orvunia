import type { MotionContext } from "./contracts.js";
export function sampleFooter(
  context: MotionContext,
  element: HTMLElement,
  property: "transform" | "opacity",
  fallback: number,
) {
  for (const [handle, target] of context.springs) {
    const animation = handle.animation;
    if (target !== element || !animation || !("effect" in animation)) continue;
    const effect = animation.effect as KeyframeEffect | null;
    const frames = effect?.getKeyframes?.();
    if (!effect || !frames?.length || frames[0]?.[property] === undefined)
      continue;
    const progress = effect.getComputedTiming?.().progress ?? 0;
    const offset = (index: number) =>
      frames[index]!.computedOffset ??
      frames[index]!.offset ??
      index / (frames.length - 1);
    const right = frames.findIndex((_, index) => offset(index) >= progress);
    const high = Math.max(0, right < 0 ? frames.length - 1 : right);
    const low = Math.max(0, high - 1);
    const number = (frame: ComputedKeyframe) =>
      property === "transform"
        ? Number(
            /translateY\(([-\d.e]+)px\)/i.exec(String(frame.transform))?.[1] ??
              fallback,
          )
        : Number(frame.opacity);
    const fraction =
      offset(high) === offset(low)
        ? 0
        : (progress - offset(low)) / (offset(high) - offset(low));
    return (
      number(frames[low]!) +
      (number(frames[high]!) - number(frames[low]!)) * fraction
    );
  }
  return fallback;
}
