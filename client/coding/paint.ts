import type { TimerOptions, TimerHandle } from "./timing";
export function createStreamRenderer(
  write: (text: string) => void,
  {
    schedule = (callback, ms) => setTimeout(callback, ms),
    cancel = (handle) => clearTimeout(handle),
  }: TimerOptions = {},
) {
  let pending: string | null = null;
  let timer: TimerHandle | null = null;
  let closed = false,
    written = 0,
    hasText = false;
  const paint = () => {
    timer = null;
    if (closed || pending === null) return;
    const text = pending;
    pending = null;
    written++;
    write(text);
  };
  return {
    push(text: string) {
      if (closed) return;
      pending = text;
      if (!text) hasText = false;
      if (!hasText && text) {
        hasText = true;
        if (timer !== null) cancel(timer);
        paint();
        return;
      }
      if (timer === null)
        timer = schedule(
          paint,
          text.length > 128000 ? 200 : text.length > 32000 ? 100 : 50,
        );
    },
    flush() {
      if (timer !== null) cancel(timer);
      timer = null;
      paint();
    },
    cancel() {
      closed = true;
      if (timer !== null) cancel(timer);
      timer = null;
      pending = null;
    },
    stats: () => ({ written, queued: timer !== null }),
  };
}
