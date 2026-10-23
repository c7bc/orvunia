import { modeResult, requiredMode } from "./boundary.js";
import { commandEditedMode } from "./guards.js";
import { field } from "./elements.js";
import type { CommandContext } from "./ports.js";
export async function runModesCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "activate-mode":
      await ports.activateMode(browser.modeEditor);
      ports.render();
      return true;
    case "mode-new": {
      browser.modeCatalog = false;
      ports.captureModeDraft();
      const result = modeResult(
        await ports.request("/modes", "POST", { base: "recruiter" }),
      );
      ports.applyModes(result);
      browser.modeEditor = requiredMode(result).id;
      ports.render();
      return true;
    }
    case "mode-catalog":
      ports.captureModeDraft();
      browser.modeCatalog = true;
      ports.render();
      return true;
    case "mode-template": {
      browser.modeCatalog = false;
      ports.captureModeDraft();
      const result = modeResult(
        await ports.request("/modes", "POST", { templateId: value }),
      );
      ports.applyModes(result);
      browser.modeEditor = requiredMode(result).id;
      ports.closeModal();
      ports.render();
      ports.toast(
        "Modo criado. Clique em Definir como ativo quando quiser usá-lo.",
      );
      return true;
    }
    case "mode-delete":
      ports.modal(
        "Excluir modo",
        `<p>Excluir <strong>${ports.escape(ports.editedMode()?.name)}</strong>? As sessões já salvas conservam o contexto original.</p><div class="form-footer">${ports.button("Cancelar", "modal-close")}${ports.button("Excluir modo", "mode-delete-confirm", "danger")}</div>`,
      );
      return true;
    case "mode-rename": {
      const name = field(context, "[data-mode-name]").value.trim();
      if (!name) throw Error("Informe um nome para o modo.");
      await ports.saveEditedMode({ name });
      ports.toast("Nome do modo salvo.");
      return true;
    }
    case "mode-delete-confirm": {
      const result = modeResult(
        await ports.request(`/modes/${browser.modeEditor}`, "DELETE"),
      );
      ports.modeDrafts.delete(browser.modeEditor);
      ports.modePromptEditor.forget(browser.modeEditor);
      ports.applyModes(result);
      browser.modeEditor = browser.selectedMode;
      ports.closeModal();
      ports.render();
      ports.broadcast({ type: "changed" });
      return true;
    }
    case "save-system-prompt":
      await ports.saveEditedMode({ systemPrompt: field(context, "#system-prompt").value });
      ports.captureModeDraft();
      ports.broadcast({ type: "changed" });
      ports.toast("Preferências salvas.");
      return true;
    case "save-instructions":
      await ports.saveEditedMode({
        instructions: field(context, "#instructions").value,
      });
      ports.captureModeDraft();
      ports.broadcast({ type: "changed" });
      ports.toast("Preferências salvas.");
      return true;
    case "document":
      if (ports.editedMode()?.documents.some((d) => d.id === value)) {
        await ports.saveEditedMode({
          documents: commandEditedMode(ports).documents.filter(
            (d) => d.id !== value,
          ),
        });
        ports.render();
      } else {
        browser.library.documents = browser.library.documents.filter(
          (d) => d.id !== value,
        );
        await ports.saveLibrary();
      }
      return true;
  }
  return false;
}
