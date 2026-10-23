import type { createApplicationCommands } from "./commands.js";
import type { NativeApplicationEvent } from "./events-contracts.js";
export function createApplicationEventDispatch(ports: {
  commands: Pick<ReturnType<typeof createApplicationCommands>, "run">;
  broadcast(value: unknown): Promise<unknown>;
  native: ((event: NativeApplicationEvent) => Promise<unknown>) | null;
}) {
  return {
    broadcast: (value: unknown) =>
      ports.commands.run(() => ports.broadcast(value)),
    native(event: NativeApplicationEvent) {
      const receive = ports.native;
      if (!receive) return Promise.resolve(undefined);
      if (event.type === "prepare-quit" || event.type === "quit-cancelled")
        return receive(event);
      return ports.commands.run(() => receive(event));
    },
  };
}
