import { randomUUID } from "node:crypto";
type MotionWindow = {
  isDestroyed(): boolean;
  isVisible(): boolean;
  hide(): void;
  show(): void;
  showInactive(): void;
  webContents: { send(channel: string, value: unknown): void };
};
type Exit = {
  window: MotionWindow;
  ticket: string;
  timer: ReturnType<typeof setTimeout> | null;
  resolve(value: { hidden: boolean }): void;
  promise: Promise<{ hidden: boolean }>;
};
export function createWindowMotion(
  options: {
    enabled?: boolean;
    timeout?: number;
    onHidden?(window: MotionWindow): void;
  } = {},
) {
  const enabled = options.enabled ?? true,
    timeout = options.timeout ?? 1200;
  const pending = new Map<string, Exit>(),
    byWindow = new WeakMap<MotionWindow, Exit>();
  function finish(request: Exit, hide: boolean) {
    if (!pending.has(request.ticket)) return;
    if (request.timer) clearTimeout(request.timer);
    pending.delete(request.ticket);
    byWindow.delete(request.window);
    if (hide && !request.window.isDestroyed()) {
      request.window.hide();
      options.onHidden?.(request.window);
    }
    request.resolve({ hidden: hide });
  }
  function cancel(window: MotionWindow) {
    const request = byWindow.get(window);
    if (request) finish(request, false);
  }
  const send = (window: MotionWindow, data: unknown) =>
    window.webContents.send("cadence:event", { type: "window-motion", data });
  return {
    show(window: MotionWindow | null | undefined, inactive = false) {
      if (!window || window.isDestroyed()) return;
      const entering = !window.isVisible() || byWindow.has(window);
      cancel(window);
      if (enabled && entering) send(window, { phase: "enter" });
      inactive ? window.showInactive() : window.show();
    },
    hide(window: MotionWindow | null | undefined) {
      if (!window || window.isDestroyed())
        return Promise.resolve({ hidden: true });
      if (!enabled || !window.isVisible()) {
        cancel(window);
        window.hide();
        return Promise.resolve({ hidden: true });
      }
      const previous = byWindow.get(window);
      if (previous) return previous.promise;
      let resolve!: Exit["resolve"];
      const promise = new Promise<{ hidden: boolean }>((done) => {
        resolve = done;
      });
      const request: Exit = {
        window,
        ticket: randomUUID(),
        timer: null,
        resolve,
        promise,
      };
      request.timer = setTimeout(() => finish(request, true), timeout);
      request.timer.unref?.();
      pending.set(request.ticket, request);
      byWindow.set(window, request);
      try {
        send(window, { phase: "exit", ticket: request.ticket });
      } catch {
        finish(request, true);
      }
      return promise;
    },
    complete(sender: unknown, ticket: unknown) {
      if (typeof ticket !== "string") return false;
      const request = pending.get(ticket);
      if (!request || request.window.webContents !== sender) return false;
      finish(request, true);
      return true;
    },
    isHiding: (window: MotionWindow) => byWindow.has(window),
    dispose() {
      for (const request of [...pending.values()]) finish(request, false);
    },
  };
}
