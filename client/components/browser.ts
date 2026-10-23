export type ComponentRoot = Document | HTMLElement;
export type MotionOptions = {
  reducedMotion?: boolean | (() => boolean);
  selector?: string;
};
export function componentBrowser(root: ComponentRoot) {
  const document = root.ownerDocument ?? (root as Document);
  const window = document.defaultView;
  if (!window?.MutationObserver) return null;
  return { document, window };
}
export function reducedMotion(
  window: Window,
  options: MotionOptions,
  media = window.matchMedia?.("(prefers-reduced-motion: reduce)"),
) {
  return typeof options.reducedMotion === "function"
    ? options.reducedMotion()
    : (options.reducedMotion ?? media?.matches ?? false);
}
