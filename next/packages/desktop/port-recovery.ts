import { desktopPort } from "./port.ts";
import { BackendPortInUse } from "./errors.ts";

export async function startOnDesktopPort<Result>(options: {
  signal: AbortSignal;
  start(port: number): Promise<Result>;
  select?: () => Promise<number>;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    options.signal.throwIfAborted();
    const port = await (options.select ?? desktopPort)();
    options.signal.throwIfAborted();
    try {
      return await options.start(port);
    } catch (error) {
      if (!(error instanceof BackendPortInUse) || attempt === 2) throw error;
    }
  }
  throw Error("Desktop port recovery exhausted");
}
