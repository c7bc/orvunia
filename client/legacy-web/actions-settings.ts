import { type WorkspaceContext } from "./workspace-types.js";
import type { Profile } from "./models.js";

import type { WorkspaceActions } from "./workspace-types.js";
export function createSettingsActions({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): WorkspaceActions {
  return {
    workspace: () => {
      if (ports.dialog().open) ports.dialog().close();
      ports.window.scrollTo({ top: 0, behavior: "smooth" });
    },
    context: workspace.contextModal,
    settings: workspace.settingsModal,
    history: () =>
      browser.liveReady ? ports.live().showHistory() : workspace.historyModal(),
    "close-modal": () => ports.dialog().close(),
    "save-context": () => {
      if (browser.liveReady) return ports.live().saveContext();
      const fields = {
        name: "ctx-name",
        role: "ctx-role",
        job: "ctx-job",
        company: "ctx-company",
        tags: "ctx-tags",
        experience: "ctx-experience",
        description: "ctx-description",
      };
      for (const [k, id] of Object.entries(fields)) {
        const v = ports.field("#" + id).value.trim();
        if (["name", "role", "job"].includes(k) && !v) {
          ports.element("#" + id).focus();
          workspace.toast("Preencha nome, especialidade e vaga.");
          return;
        }
        browser.profile[k as keyof Profile] = v;
      }
      ports.storage.write("profile", browser.profile);
      workspace.renderProfile();
      workspace.renderAnswer();
      ports.dialog().close();
      workspace.toast("Contexto salvo neste navegador.");
    },
    "save-settings": () => {
      if (browser.liveReady) return ports.live().saveSettings();
      browser.preferences.output = ports.field("#pref-output").value;
      browser.preferences.code = ports.field("#pref-code").value;
      ports.storage.write("preferences", browser.preferences);
      workspace.renderAnswer();
      ports.dialog().close();
      workspace.toast("Preferências salvas.");
    },
    shortcuts: () =>
      workspace.modal(
        "Seu ritmo, seus atalhos",
        `<p class="help">Atalhos funcionam enquanto o Studio está em foco. Não são atalhos globais do sistema.</p><table class="shortcuts-table"><tr><td>Preparar resposta</td><td><kbd>Ctrl Enter</kbd></td></tr><tr><td>${browser.liveReady ? "Capturar tela" : "Simular captura"}</td><td><kbd>Alt H</kbd></td></tr><tr><td>Nova sessão</td><td><kbd>N</kbd></td></tr><tr><td>Alternar modos</td><td><kbd>Alt 1</kbd> <kbd>Alt 2</kbd></td></tr><tr><td>Fechar painel / diálogo</td><td><kbd>Esc</kbd></td></tr></table>`,
      ),
  };
}
