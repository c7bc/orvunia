export type SurfaceAnimation = Pick<Animation, "finished" | "cancel">;
export type SurfaceAnimator = (
  element: HTMLElement | null,
  frames: Keyframe[],
  duration?: number,
) => SurfaceAnimation | undefined;
export function createSurfaceAnimator(
  reducedMotion: () => boolean,
): SurfaceAnimator {
  return (element, frames, duration = 160) => {
    if (!element?.animate || reducedMotion()) return;
    const animation = element.animate(frames, {
      duration,
      easing: "cubic-bezier(0,0,.2,1)",
      fill: "none",
    });
    void animation.finished.catch(() => {});
    return animation;
  };
}
