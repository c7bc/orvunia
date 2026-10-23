import type {
  SpringHandle,
  SpringParameters,
  SpringSample,
  AnimationOptions,
  SpringTarget,
} from "../motion/domain.js";
import type { SurfaceAnimator } from "./animation.js";
export type MotionPhase = "enter" | "exit";
export type SpringRecord = {
  handle: SpringHandle;
  parameters: SpringParameters;
  completed: boolean;
};
export type WindowRun = {
  element: HTMLElement;
  active: boolean;
  alpha: SpringRecord;
  position: SpringRecord;
};
export type WindowTransitionDependencies = {
  target(): { view: string; element: HTMLElement | null };
  reducedMotion(): boolean;
  beforeExit(): void;
  readStyle(
    element: HTMLElement,
  ): Pick<CSSStyleDeclaration, "opacity" | "transform">;
  spring(element: SpringTarget, options: AnimationOptions): SpringHandle;
  sample(parameters: SpringParameters, milliseconds: number): SpringSample;
  animate: SurfaceAnimator;
};
