import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceDragEnd(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(
    ports.element("#compact-handle"),
    "pointerup",
    () => (browser.drag = null),
  );
}
