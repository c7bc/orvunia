import { type BrowserContext, type LiveController } from "./contracts.js";

export function createBindingMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<LiveController, "bind"> {
  return {
    bind(this: LiveController) {
      ports.document.addEventListener("change", async (e) => {
        const target = e.target as HTMLInputElement | null;
        if (target?.id === "live-code-language") {
          browser.preferences.code = target.value;
          try {
            await ports.api.request("/preferences", {
              method: "PUT",
              body: browser.preferences,
            });
            ports.write("preferences", browser.preferences);
          } catch (error) {
            this.reportError(error);
          }
        }
      });
      ports.document.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement | null;
        const b = target?.closest<HTMLElement>(
          "[data-live-action],[data-live-image]",
        );
        if (!b) return;
        if (b.dataset.liveImage) {
          ports.modal(
            "Contexto visual",
            `<img class="capture-detail" src="${ports.escape(b.dataset.liveImage)}" alt="Captura de contexto">`,
          );
          return;
        }
        const action = b.dataset.liveAction;
        if (action === "add-text") this.addText();
        if (action === "save-text") await this.saveText();
        if (action === "upload-audio") this.uploadAudioModal();
        if (action === "transcribe-file") await this.transcribeFile();
        if (action === "copy-generated-code") {
          const text = this.answers[browser.mode]?.text || "",
            code = text.match(/```[^\n]*\n([\s\S]*?)```/);
          await ports.copy(code?.[1] ?? text);
        }
        if (action === "upload-image") {
          ports.modal(
            "Importar contexto visual",
            `<div class="field"><label for="live-image-file">Imagem (até 4 MB)</label><input type="file" id="live-image-file" accept="image/png,image/jpeg,image/webp"></div>`,
            `<button class="primary" data-live-action="save-image">Adicionar imagem</button>`,
          );
        }
        if (action === "save-image") {
          try {
            const file = ports.field("#live-image-file").files?.[0];
            if (!file) throw new Error("Escolha uma imagem.");
            await this.uploadImage(file);
            ports.dialog().close();
            browser.inputTab = "captures";
            ports.renderInput();
          } catch (error) {
            this.reportError(error);
          }
        }
      });
    },
  };
}
