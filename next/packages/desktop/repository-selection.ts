export function repositorySelections() {
  const selections = new Map<string, AbortController>();
  return {
    async choose<T>(key: string, choose: () => Promise<T>, signal: AbortSignal) {
      selections.get(key)?.abort();
      const controller = new AbortController();
      selections.set(key, controller);
      const combined = AbortSignal.any([controller.signal, signal]);
      let abort: (() => void) | undefined;
      try {
        combined.throwIfAborted();
        const cancelled = new Promise<never>((_resolve, reject) => {
          abort = () => reject(new Error("repository_cancelled"));
          combined.addEventListener("abort", abort, { once: true });
        });
        return await Promise.race([choose(), cancelled]);
      } finally {
        if (abort) combined.removeEventListener("abort", abort);
        if (selections.get(key) === controller) selections.delete(key);
      }
    },
    cancel(key: string) { selections.get(key)?.abort(); selections.delete(key); },
    close() { for (const controller of selections.values()) controller.abort(); selections.clear(); },
  };
}
