export function createNativeShutdown(ports: {
  drain(): Promise<unknown>;
  stop(): Promise<unknown>;
  quit(): void;
  failed(): void;
  cancel(): void;
}) {
  let pending: Promise<void> | null = null,
    ready = false;
  return {
    ready: () => ready,
    running: () => pending !== null,
    request() {
      if (ready) return Promise.resolve();
      if (pending) return pending;
      const attempt = Promise.resolve().then(async () => {
        try {
          await ports.drain();
          await ports.stop();
          ready = true;
          ports.quit();
        } catch {
          ports.cancel();
          ports.failed();
        } finally {
          if (pending === attempt) pending = null;
        }
      });
      pending = attempt;
      return attempt;
    },
  };
}
