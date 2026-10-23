import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceKeydown(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.document, "keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (e.key === "Escape") {
      ports.element("#compact-panel").hidden = true;
      return;
    }
    if (!browser.liveReady) return;
    if (ports.dialog().open) return;
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      (ports.element("#composer") as HTMLFormElement).requestSubmit();
      return;
    }
    if (e.altKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      workspace.simulateCapture();
      return;
    }
    if (e.altKey && ["1", "2"].includes(e.key)) {
      e.preventDefault();
      workspace.cancelGeneration();
      browser.mode = e.key === "1" ? "recruiter" : "technical";
      browser.answerKind = "assist";
      workspace.renderMode();
      return;
    }
    if (
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.repeat &&
      !target.matches("input,textarea,select") &&
      e.key.toLowerCase() === "n"
    ) {
      e.preventDefault();
      workspace.newSession();
    }
  });
}
