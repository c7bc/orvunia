import {
  commandError,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
import { bindDesktopFocusout } from "./event-focusout.js";
import { bindDesktopClick } from "./event-click.js";
import { bindDesktopInput } from "./event-input.js";
import { bindDesktopChange } from "./event-change.js";
import { bindDesktopSubmit } from "./event-submit.js";
import { bindDesktopDblclick } from "./event-dblclick.js";
import { bindDesktopKeydown } from "./event-keydown.js";
import { bindDesktopVisibilitychange } from "./event-visibilitychange.js";
import { bindDesktopClick2 } from "./event-click-2.js";
export function installDesktopEvents(
  context: CommandEventContext,
): CommandEvents {
  const abort = new AbortController();
  const pending = new Set<Promise<void>>();
  const report = (error: unknown) => {
    if (!abort.signal.aborted) context.ports.toast(commandError(error));
  };
  const events: CommandEvents = {
    async settle() {
      while (pending.size) await Promise.all([...pending]);
    },
    active: () => !abort.signal.aborted,
    on(name, callback) {
      context.ports.document.addEventListener(
        name,
        (event) => {
          if (abort.signal.aborted) return;
          try {
            const operation = Promise.resolve(callback(event)).catch(report);
            pending.add(operation);
            void operation.then(
              () => pending.delete(operation),
              () => pending.delete(operation),
            );
          } catch (error) {
            report(error);
          }
        },
        { signal: abort.signal },
      );
    },
    dispose() {
      if (abort.signal.aborted) return;
      abort.abort();
      if (context.state.sessionSearchTimer !== null)
        context.ports.window.clearTimeout(context.state.sessionSearchTimer);
      context.state.sessionSearchTimer = null;
      context.state.sessionSearchEpoch++;
    },
  };
  for (const bind of [
    bindDesktopFocusout,
    bindDesktopClick,
    bindDesktopInput,
    bindDesktopChange,
    bindDesktopSubmit,
    bindDesktopDblclick,
    bindDesktopKeydown,
    bindDesktopVisibilitychange,
    bindDesktopClick2,
  ])
    bind(context, events);
  return events;
}
