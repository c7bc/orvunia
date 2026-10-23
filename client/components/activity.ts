import { componentBrowser, reducedMotion } from "./browser.js";
import type { ComponentRoot, MotionOptions } from "./browser.js";
import { activityFrames } from "./activity-frames.js";
type Activity = {
  element: HTMLElement;
  start: number;
  animation: Animation | null;
  reduced: boolean;
  width: number;
  remeasure?: boolean;
};
export function installSessionActivity(
  root: ComponentRoot = document,
  options: MotionOptions & { now?: () => number } = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { document, window } = browser;
  const clock =
    options.now ?? (() => window.performance?.now?.() ?? Date.now());
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reduced = () => reducedMotion(window, options, media);
  const records = new Map<string, Activity>();
  let pending = false,
    disposed = false;
  const resize = window.ResizeObserver
    ? new window.ResizeObserver((entries) => {
        for (const { target } of entries)
          for (const record of records.values())
            if (
              record.element === target &&
              target.hasAttribute("data-transcript-pending")
            ) {
              const width = target.getBoundingClientRect().width;
              if (Math.abs(width - record.width) > 0.25) {
                record.width = width;
                record.remeasure = true;
                schedule();
              }
            }
      })
    : null;
  function refresh() {
    pending = false;
    if (disposed) return;
    const seen = new Set<string>();
    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-voice-activity],[data-transcript-pending],[data-answer-pending]",
    )) {
      if (element.closest("[data-motion-exit]")) continue;
      const voice = element.hasAttribute("data-voice-activity");
      const answer = element.hasAttribute("data-answer-pending");
      const dot = voice || answer;
      const key =
        (voice ? "voice:" : answer ? "answer:" : "pending:") +
        (voice
          ? element.dataset.voiceActivity
          : answer
            ? element.dataset.answerPending
            : element.dataset.transcriptPending);
      seen.add(key);
      const old = records.get(key);
      const start = old?.start ?? clock();
      if (
        old?.element === element &&
        old.reduced === reduced() &&
        !old.remeasure
      )
        continue;
      if (old?.element && old.element !== element)
        resize?.unobserve(old.element);
      old?.animation?.cancel();
      let animation: Animation | null = null;
      if (!reduced() && element.animate) {
        const { frames, timing } = activityFrames(
          element,
          document,
          window,
          dot,
        );
        animation = element.animate(frames, timing);
        animation.finished?.catch?.(() => {});
        animation.currentTime = Math.max(0, clock() - start) % timing.duration;
      }
      records.set(key, {
        element,
        start,
        animation,
        reduced: reduced(),
        width: element.getBoundingClientRect().width,
      });
      if (!dot) resize?.observe(element);
    }
    for (const [key, item] of records)
      if (!seen.has(key)) {
        item.animation?.cancel();
        resize?.unobserve(item.element);
        records.delete(key);
      }
  }
  function schedule() {
    if (!disposed && !pending) {
      pending = true;
      queueMicrotask(refresh);
    }
  }
  const reset = () => {
    for (const record of records.values()) {
      record.animation?.cancel();
      record.remeasure = true;
    }
    refresh();
  };
  const observer = new window.MutationObserver(schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.addEventListener("resize", reset);
  media?.addEventListener?.("change", reset);
  document.fonts?.ready?.then(() => {
    if (!disposed) reset();
  });
  refresh();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener("resize", reset);
    media?.removeEventListener?.("change", reset);
    for (const record of records.values()) record.animation?.cancel();
    records.clear();
  };
}
