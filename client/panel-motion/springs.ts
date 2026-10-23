import { createSpringAnimator } from "../motion/index.js";
import type {
  SpringHandle,
  AnimationOptions,
  SpringProperty,
} from "../motion/domain.js";
import type { MotionContext } from "./contracts.js";
import { sampleFooter } from "./sampling.js";
export function motionSprings(context: MotionContext) {
  const animate = createSpringAnimator();
  function start(
    element: HTMLElement,
    options: AnimationOptions,
  ): SpringHandle {
    const handle = animate(element, {
      ...options,
      reducedMotion: context.reduced,
    });
    context.springs.set(handle, element);
    handle.finished.finally(() => {
      context.springs.delete(handle);
      context.schedule();
    });
    return handle;
  }
  function scale(element: HTMLElement, from: number, to: number) {
    return start(element, {
      stiffness: 520,
      damping: 28,
      mass: 0.7,
      from,
      to,
      property: "scale",
      restSpeed: 0.01,
      restDelta: 0.005,
      restCriterion: "threshold",
    });
  }
  function footer(
    element: HTMLElement,
    fromY: number,
    toY: number,
    fromOpacity: number,
    toOpacity: number,
  ) {
    const handles = [
      start(element, {
        stiffness: 420,
        damping: 28,
        mass: 0.45,
        from: fromY,
        to: toY,
        property: "transform",
        format: (value) => `translateY(${value}px)`,
      }),
      start(element, {
        stiffness: 420,
        damping: 28,
        mass: 0.45,
        from: fromOpacity,
        to: toOpacity,
        property: "opacity",
      }),
    ];
    return Promise.all(handles.map((handle) => handle.finished));
  }
  function chat(element: HTMLElement) {
    const properties: [SpringProperty, number][] = [
      ["scale", 0.85],
      ["opacity", 0],
    ];
    for (const [property, from] of properties)
      start(element, {
        stiffness: 280,
        damping: 16,
        mass: 0.9,
        property,
        from,
        to: 1,
      });
  }
  return {
    scale,
    footer,
    chat,
    value: (
      element: HTMLElement,
      property: "transform" | "opacity",
      fallback: number,
    ) => sampleFooter(context, element, property, fallback),
  };
}
export type MotionSprings = ReturnType<typeof motionSprings>;
