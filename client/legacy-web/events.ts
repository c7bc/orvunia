export interface WorkspaceEvents {
  active(): boolean;
  on<Key extends keyof DocumentEventMap>(
    target: Document,
    type: Key,
    listener: (event: DocumentEventMap[Key]) => void,
  ): void;
  on<Key extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: Key,
    listener: (event: HTMLElementEventMap[Key]) => void,
  ): void;
  interval(callback: () => void, milliseconds: number): void;
  dispose(): void;
}
export function createWorkspaceEvents(
  window: Pick<Window, "setInterval" | "clearInterval">,
): WorkspaceEvents {
  const cleanups: (() => void)[] = [];
  let disposed = false;
  function on(target: EventTarget, type: string, listener: EventListener) {
    if (disposed) return;
    const current: EventListener = (event) => {
      if (!disposed) listener(event);
    };
    target.addEventListener(type, current);
    cleanups.push(() => target.removeEventListener(type, current));
  }
  return {
    active: () => !disposed,
    on: on as WorkspaceEvents["on"],
    interval(callback, milliseconds) {
      if (disposed) return;
      const timer = window.setInterval(() => {
        if (!disposed) callback();
      }, milliseconds);
      cleanups.push(() => window.clearInterval(timer));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}
