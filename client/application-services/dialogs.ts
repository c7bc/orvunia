import type { ApplicationState } from "../application/model.js";
import type { CommandPrompt } from "../commands/model.js";
import type {
  ApplicationButton,
  ApplicationModal,
  ApplicationRequest,
  ApplicationTranslate,
} from "./contracts.js";
import { createNotePresets } from "./presets.js";
import { updateResult } from "./updates.js";
export function createApplicationDialogs(ports: {
  state: ApplicationState;
  document: Document;
  request: ApplicationRequest;
  modal: ApplicationModal;
  button: ApplicationButton;
  translate: ApplicationTranslate;
  modeBase(id: string): string;
  escape(value: unknown): string;
  icon(name: string, size: number): string;
  toast(message: string): void;
  chooseFiles?(accept: string, multiple: boolean): Promise<File[]>;
}) {
  const { state, document, modal, button, escape: esc } = ports;
  const presets = createNotePresets();
  return {
    presets,
    promptEditor(prompt?: CommandPrompt) {
      modal(
        prompt?.id ? "Editar prompt" : "Criar prompt",
        `<form id="prompt-form" data-id="${prompt?.id || ""}"><div class="fields"><div class="field full"><label for="prompt-title">Nome da ação</label><input id="prompt-title" name="title" required maxlength="100" value="${esc(prompt?.title)}" placeholder="Ex.: Explicar uma decisão técnica"></div><div class="field full"><label for="prompt-mode">Modo</label><select name="mode" id="prompt-mode"><option value="recruiter">Recrutador</option><option value="technical" ${(prompt?.mode || ports.modeBase(state.modeEditor)) === "technical" ? "selected" : ""}>Entrevista técnica</option></select></div><div class="field full"><label for="prompt-instructions">O que o assistente deve fazer?</label><textarea id="prompt-instructions" name="instructions" rows="6" required maxlength="6000">${esc(prompt?.instructions)}</textarea></div></div><div class="form-footer">${button("Cancelar", "modal-close")}<button class="btn primary" type="submit">Salvar prompt</button></div></form>`,
      );
    },
    clear() {
      modal(
        "Limpar contexto",
        `<p>Escolha o que deseja remover desta sessão.</p><div class="stack" style="gap:9px;margin-top:20px">${button("Limpar somente respostas", "clear-responses", "", "chat")}${button("Limpar transcrição", "clear-transcripts", "", "mic")}${button("Remover capturas", "clear-captures", "", "screen")}</div>`,
      );
    },
    noteTemplates() {
      modal(
        "Modelos de notas",
        `<p class="subtitle">Escolha um ponto de partida e personalize as seções.</p><div class="note-preset-grid">${Object.entries(
          presets,
        )
          .map(
            ([key, preset]) =>
              `<button class="note-preset" data-action="note-template:${key}">${ports.icon(key === "technical" ? "code" : "file", 22)}<strong>${preset.title}</strong><span>${preset.description}</span></button>`,
          )
          .join("")}</div>`,
      );
    },
    filePicker(
      accept: string,
      callback: (files: File[]) => Promise<unknown>,
      multiple = false,
    ) {
      if (ports.chooseFiles) {
        void ports.chooseFiles(accept, multiple).then(files => callback(files)).catch((error: unknown) =>
          ports.toast(error instanceof Error ? error.message : String(error)));
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = multiple;
      input.onchange = () => {
        void callback([...(input.files ?? [])]).catch((error: unknown) =>
          ports.toast(error instanceof Error ? error.message : String(error)),
        );
      };
      input.click();
    },
    async checkUpdates() {
      modal("Atualizações", "<p role='status'>Verificando atualizações…</p>");
      const dialog = document.querySelector("#dialogs .modal");
      const target = {
        version: state.desktop.version || state.releaseVersion,
        platform: state.desktop.platform || "win32",
        arch: state.desktop.arch || "x64",
      };
      try {
        const result = updateResult(
          await ports.request("/updates?" + new URLSearchParams(target)),
        );
        if (!dialog?.isConnected) return;
        const messages = {
          "not-configured":
            "Esta instalação não tem um canal de atualizações configurado.",
          unavailable:
            "Não foi possível verificar atualizações. Tente novamente mais tarde.",
          current: "Você está usando a versão mais recente deste canal.",
          available: "Uma nova versão está disponível.",
        };
        modal(
          "Atualizações",
          `<p>${esc(ports.translate(messages[result.status]))}</p><p>${esc(ports.translate("Versão instalada"))}: <span data-i18n-skip>${esc(target.version)}</span></p>${result.release ? `<h3 data-i18n-skip>Orvunia ${esc(result.release.version)}</h3><p data-i18n-skip>${esc(result.release.notes)}</p><small data-i18n-skip>SHA256 ${esc(result.release.sha256)}</small><div class="form-footer"><button class="btn primary" data-update-download="${esc(result.release.url)}">${esc(ports.translate("Baixar atualização"))}</button></div>` : ""}`,
        );
      } catch (error) {
        if (dialog?.isConnected)
          modal(
            "Atualizações",
            `<p role="alert">${esc(error instanceof Error ? error.message : String(error))}</p>`,
          );
      }
    },
  };
}
