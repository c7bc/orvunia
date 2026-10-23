import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceChange(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.on(ports.document, "change", async (e) => {
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    if (target.id === "code-language") {
      browser.preferences.code = target.value;
      ports.storage.write("preferences", browser.preferences);
      if (browser.liveReady)
        void ports.api
          .request("/preferences", { method: "PUT", body: browser.preferences })
          .catch((e) => ports.live().reportError(e));
      workspace.renderAnswer();
    }
    if (target.id === "problem-selector") {
      workspace.cancelGeneration();
      browser.currentProblem = target.value;
      if (browser.liveReady) {
        ports.live().practiceSelected = true;
        ports.live().answers.technical = null;
      } else
        browser.transcripts.technical = workspace.problemTranscript(
          browser.currentProblem,
        );
      browser.answerKind = "assist";
      browser.codeTab = "code";
      browser.testsRun = false;
      workspace.renderInput();
      workspace.renderAnswer();
    }
    if (target.id === "context-file") {
      const file = target.files?.[0];
      if (!file) return;
      if (file.size > 100000) {
        workspace.toast("Use um arquivo de texto de até 100 KB.");
        return;
      }
      if (!/\.(txt|md)$/i.test(file.name)) {
        workspace.toast("Escolha um arquivo .txt ou .md.");
        return;
      }
      try {
        const field = ports.field("#ctx-experience");
        const value = await file.text();
        if (
          !events.active() ||
          !field.isConnected ||
          !target.isConnected ||
          ports.optional("#ctx-experience") !== field
        )
          return;
        field.value = value.slice(0, 15000);
        workspace.toast("Texto importado. Salve para aplicar.");
      } catch {
        workspace.toast("Não foi possível ler o arquivo.");
      }
    }
  });
}
