import { OperationError } from "./domain.ts";

export function operationSupervisor() {
  const active = new Map<AbortController, Promise<unknown>>();
  let closing = false;
  const assertOpen = () => {
    if (closing) throw new OperationError("operation_busy");
  };
  return {
    assertOpen,
    async run<Result>(
      signal: AbortSignal,
      execute: (signal: AbortSignal) => Promise<Result>,
    ) {
      assertOpen();
      const controller = new AbortController();
      const task = execute(AbortSignal.any([signal, controller.signal]));
      active.set(controller, task);
      try {
        return await task;
      } finally {
        active.delete(controller);
      }
    },
    async close() {
      closing = true;
      for (const controller of active.keys()) controller.abort();
      await Promise.allSettled(active.values());
    },
  };
}
