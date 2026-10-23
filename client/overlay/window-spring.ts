import type { SpringSample } from "../motion/domain.js";
import type {
  WindowTransitionDependencies,
  WindowRun,
} from "./window-types.js";
export function controlWindowSpring(options: {
  dependencies: WindowTransitionDependencies;
  element: HTMLElement;
  signal: AbortSignal;
  entering: boolean;
  opacityFrom: number;
  opacityTo: number;
  alphaState: SpringSample | null;
  positionState: SpringSample | null;
}) {
  const {
    dependencies,
    element,
    signal,
    entering,
    opacityFrom,
    opacityTo,
    alphaState,
    positionState,
  } = options;
  const oscillator = { stiffness: 420, damping: 28, mass: 0.45 };
  const alphaParameters = {
    ...oscillator,
    from: opacityFrom,
    to: opacityTo,
    velocity: alphaState?.velocity || 0,
  };
  const alpha = dependencies.spring(element, {
    ...alphaParameters,
    property: "opacity",
    restDelta: 0.005,
    restSpeed: 0.01,
    restCriterion: "threshold",
    signal,
    reducedMotion: dependencies.reducedMotion(),
  });
  const parameters = {
    ...oscillator,
    from: positionState?.value ?? (entering ? 10 : 0),
    to: entering ? 0 : 10,
    velocity: positionState?.velocity || 0,
  };
  const position = dependencies.spring(element, {
    ...parameters,
    property: "transform",
    format: (value) => `translateY(${value}px)`,
    restDelta: 0.5,
    restSpeed: 2,
    restCriterion: "threshold",
    signal,
    reducedMotion: dependencies.reducedMotion(),
  });
  const run: WindowRun = {
    element,
    active: true,
    alpha: { handle: alpha, parameters: alphaParameters, completed: false },
    position: { handle: position, parameters, completed: false },
  };
  void alpha.finished.then((result) => {
    run.alpha.completed = result.status !== "cancelled";
  });
  void position.finished.then((result) => {
    run.position.completed = result.status !== "cancelled";
  });
  return { run, finished: Promise.all([alpha.finished, position.finished]) };
}
