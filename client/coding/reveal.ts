import type { TimerOptions, TimerHandle } from "./timing";
export type RevealInput = {
  sessionId: string;
  responseId: string;
  generation: number;
  text: string;
};
export type RevealState = RevealInput & {
  position: number;
  visibleText: string;
};
export type RevealFrame = RevealState & { done: boolean; cancelled?: boolean };
type RevealOptions = TimerOptions & {
  onFrame?: (state: RevealFrame) => void;
  isCurrent?: (state: RevealState) => boolean;
  reducedMotion?: () => boolean;
};
export function createPreparedReveal({
  onFrame = () => {},
  isCurrent = () => true,
  reducedMotion = () => false,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle),
}: RevealOptions = {}) {
  let state: RevealState | null = null;
  let timer: TimerHandle | null = null;
  let disposed = false;
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  const stop = (restore = true) => {
    clear();
    const previous = state;
    state = null;
    if (previous && restore && isCurrent(previous))
      onFrame({
        ...previous,
        visibleText: previous.text,
        done: true,
        cancelled: true,
      });
  };
  const tick = () => {
    timer = null;
    if (!state) return;
    if (!isCurrent(state)) {
      stop(false);
      return;
    }
    state.position = reducedMotion()
      ? state.text.length
      : Math.min(state.text.length, state.position + 30);
    state.visibleText = state.text.slice(0, state.position);
    const done = state.position >= state.text.length;
    onFrame({ ...state, done });
    if (done) state = null;
    else timer = schedule(tick, 50);
  };
  return {
    start(value: RevealInput) {
      stop();
      if (disposed) return;
      state = {
        ...value,
        text: String(value.text || ""),
        position: 0,
        visibleText: "",
      };
      if (!isCurrent(state)) {
        stop(false);
        return;
      }
      if (reducedMotion() || !state.text) {
        const complete = state;
        state = null;
        onFrame({ ...complete, visibleText: complete.text, done: true });
        return;
      }
      onFrame({ ...state, done: false });
      timer = schedule(tick, 50);
    },
    get: () => (state ? { ...state } : null),
    cancel: () => stop(),
    dispose() {
      stop();
      disposed = true;
    },
    stats: () => ({ active: state ? 1 : 0, timers: timer === null ? 0 : 1 }),
  };
}
