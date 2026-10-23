import { type WorkspaceContext } from "./workspace-types.js";

import { isInterviewMode } from "./contracts.js";
import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceClick(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.document, "click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const button = target.closest<HTMLElement>("button,a.brand");
    if (!button) return;
    if (button.matches("a.brand")) {
      e.preventDefault();
      actions.workspace!();
      return;
    }
    if (button.dataset.action && actions[button.dataset.action]) {
      if (
        !browser.liveReady &&
        ![
          "workspace",
          "context",
          "settings",
          "shortcuts",
          "close-modal",
          "compact",
          "close-compact",
        ].includes(button.dataset.action)
      ) {
        workspace.toast("O servidor ainda não está conectado.");
        return;
      }
      actions[button.dataset.action]!();
      return;
    }
    if (button.dataset.mode) {
      workspace.cancelGeneration();
      if (!isInterviewMode(button.dataset.mode)) return;
      browser.mode = button.dataset.mode;
      browser.answerKind = "assist";
      browser.codeTab = "code";
      browser.inputTab = "transcript";
      ports.field("#prompt").value = "";
      workspace.renderMode();
      return;
    }
    if (button.dataset.answer) {
      workspace.generate(button.dataset.answer);
      return;
    }
    if (button.dataset.inputTab) {
      browser.inputTab = button.dataset.inputTab;
      workspace.renderInput();
      return;
    }
    if (button.dataset.codeTab) {
      browser.codeTab = button.dataset.codeTab;
      workspace.renderAnswer();
      return;
    }
    if (button.dataset.history !== undefined) {
      const report = browser.history[Number(button.dataset.history)];
      if (report) workspace.summaryModal(report);
      return;
    }
    if (button.dataset.capture !== undefined) {
      const c = browser.captures[browser.mode][Number(button.dataset.capture)];
      if (!c) return;
      workspace.modal(
        c.title,
        `<p class="help">Captura de demonstração. Nenhuma tela real foi registrada.</p><div class="capture-preview">${ports.escape(c.preview).replace(/\n/g, "<br>")}</div>`,
      );
    }
  });
}
