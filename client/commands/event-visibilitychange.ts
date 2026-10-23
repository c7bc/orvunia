import { type CommandEventContext, type CommandEvents } from "./event-types.js";
export function bindDesktopVisibilitychange(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("visibilitychange", () => {
    if (ports.document.hidden) ports.preparedReveal.cancel();
  });
}
