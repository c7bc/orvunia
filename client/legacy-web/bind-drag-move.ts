import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceDragMove(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.element("#compact-handle"), "pointermove", (e) => {
    if (!browser.drag) return;
    const p = ports.element("#compact-panel");
    p.style.left =
      Math.max(
        0,
        Math.min(
          ports.window.innerWidth - p.offsetWidth,
          e.clientX - browser.drag.x,
        ),
      ) + "px";
    p.style.top =
      Math.max(
        0,
        Math.min(
          ports.window.innerHeight - p.offsetHeight,
          e.clientY - browser.drag.y,
        ),
      ) + "px";
    p.style.right = "auto";
    p.style.bottom = "auto";
  });
}
