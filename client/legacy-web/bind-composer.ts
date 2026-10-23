import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceComposer(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.element("#composer"), "submit", (e) => {
    e.preventDefault();
    const v = ports.field("#prompt").value.trim();
    if (!v) {
      workspace.generate("assist");
      return;
    }
    browser.customQuestion = v.slice(0, 3000);
    ports.field("#prompt").value = "";
    workspace.generate("custom");
  });
}
