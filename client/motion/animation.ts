import type {
  SpringTarget,
  SpringHandle,
  AnimationOptions,
  SpringStatus,
  NativeAnimation,
} from "./domain";
import { springKeyframes } from "./keyframes";
export function createSpringAnimator() {
  const active = new WeakMap<SpringTarget, Map<string, SpringHandle>>();
  return function animateSpring(
    element: SpringTarget,
    options: AnimationOptions = {},
  ): SpringHandle {
    if (!element?.style)
      throw new TypeError("Spring target must have a style object");
    const plan = springKeyframes(options),
      property = plan.property,
      replaceKey = options.replaceKey ?? property,
      signal = options.signal,
      preference = options.reducedMotion,
      reduced =
        typeof preference === "function"
          ? preference()
          : (preference ??
            element.ownerDocument?.defaultView?.matchMedia?.(
              "(prefers-reduced-motion: reduce)",
            ).matches ??
            false);
    if (typeof replaceKey !== "string" || !replaceKey)
      throw new TypeError("Invalid spring replaceKey");
    if (
      preference !== undefined &&
      typeof preference !== "boolean" &&
      typeof preference !== "function"
    )
      throw new TypeError("Invalid spring reducedMotion");
    let resolve: (result: { status: SpringStatus }) => void = () => {};
    let complete = false;
    let animation: NativeAnimation | null = null;
    const finished = new Promise<{ status: SpringStatus }>((done) => {
      resolve = done;
    });
    const finish = (status: SpringStatus) => {
      if (complete) return;
      complete = true;
      signal?.removeEventListener("abort", onAbort);
      const registry = active.get(element);
      if (registry?.get(replaceKey) === handle) {
        registry.delete(replaceKey);
        if (!registry.size) active.delete(element);
      }
      try {
        animation?.cancel();
      } catch {
        /* Already detached/cancelled by the renderer. */
      }
      resolve({ status });
    };
    const onAbort = () => finish("cancelled");
    const handle = {
      finished,
      cancel: onAbort,
      get animation() {
        return animation;
      },
      duration: plan.duration,
      settled: plan.settled,
    };
    if (signal?.aborted) {
      finish("cancelled");
      return handle;
    }
    active.get(element)?.get(replaceKey)?.cancel();
    const final = plan.keyframes.at(-1)?.[property];
    if (final !== undefined) element.style[property] = final;
    if (reduced || !element.animate || plan.duration === 0) {
      finish(reduced ? "reduced" : "finished");
      return handle;
    }
    animation = element.animate(plan.keyframes, plan.timing);
    const registry = active.get(element) || new Map();
    registry.set(replaceKey, handle);
    active.set(element, registry);
    signal?.addEventListener("abort", onAbort, { once: true });
    // A fake/browser can abort while constructing the native animation.
    if (signal?.aborted) onAbort();
    Promise.resolve(animation.finished).then(
      () => finish("finished"),
      () => finish("cancelled"),
    );
    return handle;
  };
}
