import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceDragStart(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.element("#compact-handle"), "pointerdown", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button")) return;
    const r = ports.element("#compact-panel").getBoundingClientRect();
    browser.drag = { x: e.clientX - r.left, y: e.clientY - r.top };
    ports.element("#compact-handle").setPointerCapture(e.pointerId);
  });
}
