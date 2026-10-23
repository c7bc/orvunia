import { type CommandEventContext, type CommandEvents } from "./event-types.js";
export function bindDesktopFocusout(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("focusout", (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    if (target.matches?.("input[data-session-title]"))
      void ports.saveSessionTitle(target);
  });
}
