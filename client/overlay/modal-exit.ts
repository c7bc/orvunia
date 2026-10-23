import type { SurfaceAnimator } from "./animation.js";
export function modalExit(options: {
  backdrop: HTMLElement;
  surface: HTMLElement | null;
  visual: { opacity: number; scale: number };
  surfaceVisual: { opacity: number; scale: number };
  document: Document;
  animate: SurfaceAnimator;
  done(): void;
}) {
  const backdrop = options.backdrop.cloneNode(true) as HTMLElement;
  const surface = backdrop.querySelector<HTMLElement>(".modal");
  backdrop.inert = true;
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.dataset.modalExit = "";
  backdrop.style.pointerEvents = "none";
  for (const node of [backdrop, ...backdrop.querySelectorAll("[id]")])
    node.removeAttribute("id");
  for (const field of backdrop.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >("input,textarea")) {
    field.value = "";
    field.removeAttribute("value");
    if (field.localName === "textarea") field.textContent = "";
  }
  options.document.body.append(backdrop);
  if (surface)
    options.animate(
      surface,
      [
        {
          opacity: options.surfaceVisual.opacity,
          scale: String(options.surfaceVisual.scale),
        },
        { opacity: 0, scale: ".95" },
      ],
      100,
    );
  const animation = options.animate(
    backdrop,
    [{ opacity: options.visual.opacity }, { opacity: 0 }],
    100,
  );
  let completed = false;
  const cleanup = () => {
    if (completed) return;
    completed = true;
    for (const element of [backdrop, surface])
      for (const running of element?.getAnimations?.() ?? []) running.cancel();
    backdrop.remove();
    options.done();
  };
  if (animation) void animation.finished.catch(() => {}).finally(cleanup);
  return { finish: cleanup, animated: Boolean(animation) };
}
