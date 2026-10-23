export async function settleRendererTasks(
  tasks: readonly (() => Promise<unknown>)[],
) {
  const results = await Promise.allSettled(
    tasks.map((task) => Promise.resolve().then(task)),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
export function createRendererShutdown(ports: {
  freeze(value: boolean): void;
  cancelAnswer(): void;
  saveTitle(): Promise<unknown>;
  saveNotes(): Promise<unknown>;
  stopRequests(): Promise<unknown>;
  stopAudio(): Promise<unknown>;
  saveElapsed(): Promise<unknown>;
}) {
  let pending: Promise<boolean> | null = null,
    version = 0,
    disposed = false,
    locked = false;
  function cancel() {
    version++;
    locked = false;
    ports.freeze(false);
  }
  function prepare() {
    if (disposed) return Promise.resolve(false);
    if (pending) return pending;
    const epoch = version;
    locked = true;
    const task = Promise.resolve().then(async () => {
      try {
        ports.freeze(true);
        ports.cancelAnswer();
        const saved = await Promise.allSettled([
          Promise.resolve().then(ports.saveTitle),
          Promise.resolve().then(ports.saveNotes),
          Promise.resolve().then(ports.stopRequests),
          Promise.resolve().then(ports.stopAudio),
        ]);
        if (saved.some((result) => result.status === "rejected"))
          throw Error("Renderer changes could not be saved");
        if (disposed || epoch !== version) return false;
        await ports.saveElapsed();
        return !disposed && epoch === version;
      } catch {
        if (!disposed && epoch === version) {
          locked = false;
          ports.freeze(false);
        }
        return false;
      } finally {
        if (pending === task) pending = null;
      }
    });
    pending = task;
    return task;
  }
  return {
    prepare,
    active: () => locked && !disposed,
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
