type EffectView = {
  target?: EventTarget | null;
  getKeyframes?(): ComputedKeyframe[];
  getComputedTiming?(): { progress?: number | null };
};
export function popupVisualState(
  element: HTMLElement | null | undefined,
  animations: readonly { effect: EffectView | null }[] = [],
) {
  const view = element?.ownerDocument?.defaultView;
  const style = element && view?.getComputedStyle(element);
  const number = (value: unknown, fallback: number) => {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const state = {
    opacity: number(style?.opacity, 1),
    scale: number(style?.scale, 1),
  };
  for (const animation of animations) {
    const effect = animation.effect;
    if (!effect || effect.target !== element) continue;
    const frames = effect.getKeyframes?.();
    const progress = effect.getComputedTiming?.().progress;
    if (!frames?.length || progress == null) continue;
    for (const property of ["opacity", "scale"] as const) {
      if (
        frames.length !== 2 ||
        frames.some((frame) => frame[property] == null)
      )
        continue;
      const first = frames[0],
        last = frames[1];
      if (!first || !last) continue;
      const from = number(first[property], state[property]);
      const to = number(last[property], state[property]);
      state[property] = from + (to - from) * progress;
    }
  }
  return state;
}
