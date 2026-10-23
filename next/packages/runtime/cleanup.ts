export function cleanupScope() {
  const handlers: (() => void | Promise<void>)[] = [];
  let closing: Promise<void> | null = null;
  return {
    defer(handler: () => void | Promise<void>) {
      if (closing) throw Error("Resource scope is closing");
      handlers.push(handler);
    },
    close(): Promise<void> {
      if (closing) return closing;
      closing = (async () => {
        const failures: unknown[] = [];
        for (const handler of handlers.reverse()) {
          try {
            await handler();
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length)
          throw new AggregateError(failures, "Resource cleanup failed");
      })();
      return closing;
    },
  };
}
