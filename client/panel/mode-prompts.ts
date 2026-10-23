import type { PanelState } from "./state.js";

function editor(state: PanelState, options: {
  id: string; label: string; description: string; value: string; action: string; rows: number; maximum: number;
}) {
  return `<section class="mode-section real-time-prompt"><label for="${options.id}">${options.label}</label>
    <p class="muted">${options.description}</p>
    <div class="prompt-editor" data-component="prompt-editor">
      <textarea id="${options.id}" data-i18n-skip rows="${options.rows}" maxlength="${options.maximum}">${state.esc(options.value)}</textarea>
      <div class="prompt-savebar"><details class="prompt-format-tools"><summary>Formatar</summary>
        <div class="editor-toolbar">
          <button data-format="bold" aria-label="Negrito"><strong>B</strong></button>
          <button data-format="italic" aria-label="Itálico"><em>I</em></button>
          <button data-format="bullet" aria-label="Lista">☷</button>
          <button data-format="numbered" aria-label="Lista numerada">≡</button>
        </div></details>${state.button("Salvar", options.action)}</div>
    </div></section>`;
}

export function modeInstructions(state: PanelState) {
  const mode = state.editedMode;
  if (!mode) return "";
  return editor(state, {
    id: "instructions", label: "Instruções do modo", rows: 5, action: "save-instructions", maximum: 65536,
    description: "Adicione orientações específicas, contexto e preferências para este modo, no idioma que preferir.",
    value: state.modeDraft?.instructions ?? mode.instructions ?? "",
  });
}

export function advancedSystemPrompt(state: PanelState) {
  const mode = state.editedMode;
  if (!mode) return "";
  return `<details class="mode-additional-options mode-system-options" data-component="advanced-system-prompt">
    <summary>Avançado · System prompt</summary>${editor(state, {
      id: "system-prompt", label: "System prompt", rows: 8, action: "save-system-prompt", maximum: 32768,
      description: "Template global de comportamento do assistente. Você pode editá-lo ou apagá-lo.",
      value: state.modeDraft?.systemPrompt ?? mode.systemPrompt ?? "",
    })}</details>`;
}
