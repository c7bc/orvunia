import type { ApplicationState } from "./model.js";
import {
  installPanelMotion,
  installPanelSelects,
  installPanelDisclosures,
  installPanelMenus,
  installSessionTabs,
  installSessionActivity,
} from "@cadence/components";
import { installOverlayLayout } from "../overlay/index.js";
import { installModePromptEditor } from "../prompt/index.js";
import { installSessionNotes } from "../notes/index.js";
import { installCodingStyle } from "../coding/render.js";
export function createApplicationComponents(ports: {
  state: ApplicationState;
  document: Document;
  toast(message: string): void;
}) {
  const { state, document } = ports;
  installCodingStyle(document);
  const installed = [
    installPanelMotion(document),
    installPanelSelects(document),
    installPanelDisclosures(document),
    installOverlayLayout(document),
    installSessionTabs(document),
    installSessionActivity(document),
    installPanelMenus(document, {
      onRequestClose({ kind }) {
        if (kind === "account") state.accountOpen = false;
        if (kind === "history") state.historyMenuId = null;
      },
    }),
  ];
  const prompt = installModePromptEditor(document, {
    getKey: (field) => field.id === "system-prompt" ? `system:${state.modeEditor}` : state.modeEditor,
    onChange: (value, id, field) => {
      const system = field.id === "system-prompt";
      const key = system ? id?.slice("system:".length) ?? state.modeEditor : id ?? state.modeEditor;
      state.modeDrafts.set(key, { ...state.modeDrafts.get(key),
        [system ? "systemPrompt" : "instructions"]: value });
    },
    onLimit: () => ports.toast("O prompt atingiu o limite de caracteres."),
  });
  const notes = installSessionNotes(document);
  return {
    prompt,
    notes,
    dispose() {
      for (const controller of installed)
        if (typeof controller === "function") controller();
        else controller.dispose();
      prompt.dispose();
      notes.dispose();
    },
  };
}
