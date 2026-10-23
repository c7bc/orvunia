import type {
  WindowTransitionDependencies,
  SpringRecord,
  WindowRun,
  MotionPhase,
} from "./window-types.js";
import { controlWindowSpring } from "./window-spring.js";
export function createWindowTransition(
  dependencies: WindowTransitionDependencies,
) {
  let controller: AbortController | null = null,
    exiting = false,
    disposed = false;
  let target: HTMLElement | null = null,
    springRun: WindowRun | null = null;
  const sample = (record: SpringRecord | undefined) => {
    if (!record) return null;
    if (record.completed) return { value: record.parameters.to, velocity: 0 };
    const animation = record.handle.animation as {
      currentTime?: unknown;
    } | null;
    return dependencies.sample(
      record.parameters,
      Number(animation?.currentTime || 0),
    );
  };
  async function play(phase: MotionPhase) {
    if (disposed) return false;
    if (phase === "exit") dependencies.beforeExit();
    const { view, element } = dependencies.target();
    const previous =
      springRun?.element === element && springRun.active ? springRun : null;
    const alphaState = sample(previous?.alpha),
      positionState = sample(previous?.position);
    const style =
      target === element && element ? dependencies.readStyle(element) : null;
    const visual = style
      ? { opacity: style.opacity, transform: style.transform }
      : null;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    exiting = phase === "exit";
    if (!element) {
      exiting = false;
      target = null;
      return false;
    }
    target = element;
    const entering = phase === "enter",
      visualOpacity = visual ? Number.parseFloat(visual.opacity) : NaN;
    const opacityFrom =
      alphaState?.value ??
      (Number.isFinite(visualOpacity) ? visualOpacity : entering ? 0 : 1);
    const opacityTo = entering ? 1 : 0;
    element.style.opacity = String(opacityTo);
    let finished: Promise<unknown>;
    if (view === "control") {
      const running = controlWindowSpring({
        dependencies,
        element,
        signal: request.signal,
        entering,
        opacityFrom,
        opacityTo,
        alphaState,
        positionState,
      });
      springRun = running.run;
      finished = running.finished;
    } else {
      const alpha = dependencies.animate(
        element,
        [{ opacity: opacityFrom }, { opacity: opacityTo }],
        100,
      );
      element.style.transform = entering ? "scale(1)" : "scale(.95)";
      const scale = Number.parseFloat(
        visual?.transform.match(/matrix(?:3d)?\(([-+.\deE]+)/)?.[1] ?? "",
      );
      const movement = dependencies.animate(
        element,
        [
          {
            transform: `scale(${Number.isFinite(scale) ? scale : entering ? 0.95 : 1})`,
          },
          { transform: entering ? "scale(1)" : "scale(.95)" },
        ],
        100,
      );
      const cancel = () => {
        alpha?.cancel();
        movement?.cancel();
      };
      request.signal.addEventListener("abort", cancel, { once: true });
      finished = Promise.all([
        alpha?.finished.catch(() => {}),
        movement?.finished.catch(() => {}),
      ]).finally(() => request.signal.removeEventListener("abort", cancel));
    }
    await finished;
    if (request.signal.aborted) return false;
    if (springRun?.element === element) springRun.active = false;
    exiting = false;
    target = null;
    return true;
  }
  return {
    play,
    target: () => target,
    exiting: () => exiting,
    dispose() {
      disposed = true;
      controller?.abort();
      exiting = false;
      target = null;
      springRun = null;
    },
  };
}
