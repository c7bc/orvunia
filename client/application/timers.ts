import type { ApplicationState } from "./model.js";

export function createApplicationTimers(ports: {
  state: ApplicationState;
  document: Document;
  clock(): number;
  duration(): number;
  time(seconds: number): string;
  refreshActivity(): void;
  elapsed(sessionId: string, seconds: number): Promise<unknown>;
  repeat(callback: () => void, delay: number): number;
  clear(timer: number): void;
}) {
  const { state } = ports;
  let disposed = false;
  const expiredActivity = new Map<string, number>();
  const timers = [
    ports.repeat(() => {
      if (disposed) return;
      const now = ports.clock();
      let expired = false;
      for (const key of expiredActivity.keys()) if (!state.voiceActivity.has(key)) expiredActivity.delete(key);
      for (const [key, entry] of state.voiceActivity)
        if (entry.active && now - entry.at >= 450 && expiredActivity.get(key) !== entry.at) {
          expiredActivity.set(key, entry.at);
          expired = true;
        }
      if (expired) ports.refreshActivity();
    }, 250),
    ports.repeat(() => {
      if (disposed) return;
      const element = ports.document.querySelector("#elapsed");
      if (element) element.textContent = ports.time(ports.duration());
    }, 1000),
    ports.repeat(() => {
      if (
        !disposed &&
        state.current?.state === "active" &&
        state.view === "overlay"
      )
        void ports.elapsed(state.current.id, ports.duration()).catch(() => {});
    }, 30000),
  ];
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      expiredActivity.clear();
      for (const timer of timers) ports.clear(timer);
    },
  };
}
