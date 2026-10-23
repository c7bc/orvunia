import {
  requiredHealth,
  type BrowserContext,
  type LiveController,
} from "./contracts.js";

export function createFormsMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<
  LiveController,
  "settingsModal" | "addText" | "uploadAudioModal"
> {
  return {
    settingsModal(this: LiveController) {
      ports.modal(
        "Preferências",
        `<div class="form-grid"><div class="field"><label for="pref-output">Idioma das respostas</label><select id="pref-output"><option value="pt-BR" ${browser.preferences.output === "pt-BR" ? "selected" : ""}>Português</option><option value="en" ${browser.preferences.output === "en" ? "selected" : ""}>English</option><option value="es" ${browser.preferences.output === "es" ? "selected" : ""}>Español</option></select></div><div class="field"><label for="pref-code">Linguagem de código</label><select id="pref-code">${["TypeScript", "JavaScript", "Python"].map((l) => `<option ${l === browser.preferences.code ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label for="pref-audio">Idioma do áudio</label><select id="pref-audio">${[
          ["pt", "Português"],
          ["en", "English"],
          ["es", "Español"],
          ["auto", "Detectar automaticamente"],
        ]
          .map(
            ([v, l]) =>
              `<option value="${v}" ${v === browser.preferences.audio ? "selected" : ""}>${l}</option>`,
          )
          .join(
            "",
          )}</select></div><div class="field"><label for="pref-source">Fonte de gravação</label><select id="pref-source"><option value="microphone" ${browser.preferences.source === "microphone" ? "selected" : ""}>Microfone</option><option value="display" ${browser.preferences.source === "display" ? "selected" : ""}>Áudio de aba / tela compartilhada</option></select></div></div><div class="field"><label for="pref-instructions">Preferências para as respostas</label><textarea id="pref-instructions" maxlength="3000">${ports.escape(browser.preferences.instructions)}</textarea></div><p class="help">A gravação envia trechos completos de aproximadamente 6 segundos à OpenAI. Para capturar áudio da chamada, escolha uma aba e habilite o compartilhamento de áudio no seletor do navegador.</p><p class="help">Resposta: ${ports.escape(requiredHealth(this).models.response)} · Transcrição: ${ports.escape(requiredHealth(this).models.transcription)}. A chave fica apenas no servidor.</p>`,
        `<button class="secondary" data-action="close-modal">Cancelar</button><button class="primary" data-action="save-settings">Salvar preferências</button>`,
      );
    },
    addText(this: LiveController) {
      ports.modal(
        "Adicionar fala",
        `<div class="field"><label for="live-speaker">Quem falou?</label><select id="live-speaker"><option>Entrevistador</option><option>Você</option></select></div><div class="field"><label for="live-transcript">Texto da fala</label><textarea id="live-transcript" maxlength="16000" placeholder="Cole uma pergunta ou trecho da conversa…"></textarea></div>`,
        `<button class="secondary" data-action="close-modal">Cancelar</button><button class="primary" data-live-action="save-text">Adicionar</button>`,
      );
    },
    uploadAudioModal(this: LiveController) {
      ports.modal(
        "Transcrever arquivo de áudio",
        `<p class="help">O arquivo será enviado à OpenAI. Use WAV, MP3, M4A, WebM, MP4, OGG ou FLAC, até 24 MB.</p><div class="field"><label for="live-audio-file">Arquivo de áudio</label><input type="file" id="live-audio-file" accept="audio/*,video/webm,video/mp4"></div><div class="field"><label for="live-audio-speaker">Identificação na transcrição</label><input id="live-audio-speaker" value="Áudio importado" maxlength="60"></div>`,
        `<button class="secondary" data-action="close-modal">Cancelar</button><button class="primary" data-live-action="transcribe-file">Transcrever</button>`,
      );
    },
  };
}
