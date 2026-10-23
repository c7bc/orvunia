import type { MotionItem } from "./contracts.js";
import type { MotionEngine } from "./engine.js";
import type { MotionSprings } from "./springs.js";
export function enterMotion(
  item: MotionItem,
  initialized: boolean,
  engine: MotionEngine,
  springs: MotionSprings,
) {
  const { type, element } = item;
  const popup = { duration: 100, easing: "cubic-bezier(.4,0,.2,1)" };
  if (type === "chat-control") springs.chat(element);
  else if (type === "footer") {
    engine.removeGhost("footer");
    if (initialized) void springs.footer(element, 10, 0, 0, 1);
  } else if (type === "dialog") {
    engine.animate(element, [{ opacity: 0 }, { opacity: 1 }], popup);
    const surface = element.querySelector<HTMLElement>(".studio-dialog");
    if (surface)
      engine.animate(
        surface,
        [
          { opacity: 0, scale: ".95" },
          { opacity: 1, scale: "1" },
        ],
        popup,
      );
  } else if (type === "editor")
    engine.animate(element, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      delay: 300,
      easing: "ease-out",
    });
  else if (type === "badge") {
    springs.scale(element, 0.5, 1);
    engine.animate(element, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 160,
      easing: "ease-out",
    });
  } else
    engine.animate(
      element,
      [
        { opacity: 0, scale: ".95" },
        { opacity: 1, scale: "1" },
      ],
      popup,
    );
}
