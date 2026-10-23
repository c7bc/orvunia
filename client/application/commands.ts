import type {
  CommandEventContext,
  CommandEvents,
} from "../commands/event-types.js";
import { installDesktopEvents } from "../commands/events.js";
import { runDesktopAction } from "../commands/index.js";

export function createApplicationCommands(context: CommandEventContext) {
  const pending = new Set<Promise<unknown>>();
  let events: CommandEvents | null = null,
    disposed = false;
  function run<Value>(
    operation: () => Promise<Value>,
  ): Promise<Value | undefined> {
    if (disposed || context.ports.document.body?.inert)
      return Promise.resolve(undefined);
    const task = Promise.resolve().then(operation);
    pending.add(task);
    const remove = () => pending.delete(task);
    void task.then(remove, remove);
    return task;
  }
  return {
    action: (name: string) => run(() => runDesktopAction(context, name)),
    run,
    install() {
      if (disposed) throw Error("Application commands are disposed");
      return (events ??= installDesktopEvents(context));
    },
    async settle() {
      do {
        await Promise.allSettled([...pending]);
        await events?.settle();
      } while (pending.size);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      events?.dispose();
    },
  };
}
