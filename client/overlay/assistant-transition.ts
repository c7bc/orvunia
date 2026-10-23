import type { SurfaceAnimator } from "./animation.js";
export type AssistantVisualState = {
  view: string;
  tab: string;
  expanded: boolean;
  menu: boolean;
};
export function createAssistantTransition(dependencies: {
  document: Document;
  state(): AssistantVisualState;
  enter(): Promise<boolean>;
  animate: SurfaceAnimator;
}) {
  let previous: AssistantVisualState | null = null;
  return function update() {
    const next = dependencies.state();
    if (next.view === "overlay") {
      if (!previous || previous.view !== next.view) void dependencies.enter();
      else if (next.expanded !== previous.expanded || next.tab !== previous.tab)
        dependencies.animate(
          dependencies.document.querySelector("#answer-content"),
          [
            { opacity: 0, transform: "translateX(6px)" },
            { opacity: 1, transform: "translateX(0)" },
          ],
          160,
        );
      if (next.menu && !previous?.menu)
        dependencies.animate(
          dependencies.document.querySelector(".overlay-menu"),
          [
            { opacity: 0, transform: "translateY(8px) scale(.95)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          100,
        );
    }
    if (next.view === "control" && previous?.view !== next.view)
      void dependencies.enter();
    previous = next;
  };
}
