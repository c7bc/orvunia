import type { PanelState } from "./state.js";
import { modeInstructions, advancedSystemPrompt } from "./mode-prompts.js";
import { modeProfessionalContext } from "./mode-profile.js";
import { renderModeRepository } from "../repository/preparation-view.js";

import { heading } from "./controls.js";
import { flowIcon } from "./controls.js";
export function renderModeCatalog(s: PanelState) {
  const order = [
    "sales",
    "recruiting",
    "team-meeting",
    "looking-for-work",
    "lecture",
    "technical-interview",
  ];
  const templates = [...s.modeTemplates].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const colors: Record<string, string> = {
    sales: "rose",
    recruiting: "amber",
    "team-meeting": "green",
    "looking-for-work": "blue",
    lecture: "purple",
    "technical-interview": "cyan",
  };
  return `<section class="mode-template-catalog">${heading("Modelos", "Comece com um modelo ou crie um modo em branco.")}<div class="mode-template-list">${templates.map((t) => `<button class="mode-template-row" data-component="mode-template" data-action="mode-template:${s.esc(t.id)}"><span class="template-symbol ${colors[t.id] || "blue"}">${flowIcon(s, t.base === "technical" ? "code" : t.id === "lecture" ? "book" : t.id === "sales" ? "store" : t.id === "team-meeting" ? "video" : t.id === "recruiting" ? "briefcase" : "graduation", 24)}</span><span><strong>${s.esc(t.name)}${s.icon("chevron", 14)}</strong><small>${s.esc(t.description)}</small></span></button>`).join("")}</div></section>`;
}
export function modes(s: PanelState) {
  const { icon, esc, button, modeEditor } = s,
    mode = s.editedMode;
  if (!mode)
    return heading("Modos", "Crie um modo para personalizar o assistente.");
  const base = mode.base,
    documents = mode.documents,
    customPrompts = s.library.prompts.filter((p) => p.mode === base);
  const repository = base === "technical" ? s.renderModeRepository?.(mode.id)
    ?? renderModeRepository({ modeId: mode.id, locale: s.uiLocale || "pt-BR", native: false,
      prepared: null, escape: esc, icon: (name, size) => icon(name, size) }) : "";
  const content = `<header class="mode-editor-title"><input class="mode-name-input" data-mode-name data-i18n-skip aria-label="${esc(s.translate("Nome do modo"))}" maxlength="80" value="${esc(s.modeName(mode.id))}"><button class="icon-btn mode-name-save" data-action="mode-rename" title="Salvar nome" aria-label="Salvar nome">${icon("check", 16)}</button><button class="mode-active ${s.selectedMode === modeEditor ? "is-active" : ""}" data-action="activate-mode">${icon("check", 13)}${s.selectedMode === modeEditor ? "Ativo" : "Definir como ativo"}</button>${!mode.builtin ? `<details class="mode-options"><summary aria-label="Opções do modo">${icon("dots", 17)}</summary><div><button data-action="mode-delete" class="destructive">${icon("trash", 15)}Excluir modo</button></div></details>` : ""}</header>${modeInstructions(s)}${modeProfessionalContext(s)}<section class="mode-section mode-reference-section"><div class="section-head"><h2>Arquivos de referência</h2>${documents.length ? `<span class="muted">${documents.length}/15</span>` : ""}</div>${documents.length ? `<div class="reference-list">${documents.map((d) => `<article class="reference-file"><span class="reference-symbol">${icon("file", 21)}</span><div class="grow"><h3 data-i18n-skip>${esc(d.name)}</h3><small>${d.text.length.toLocaleString(s.uiLocale || "pt-BR")} caracteres</small></div>${s.ib("trash", `document:${d.id}`, "Remover referência")}</article>`).join("")}</div><div class="reference-upload">${button("Adicionar arquivo", "import", "", "attach")}</div>` : `<div class="reference-empty"><p>Adicione arquivos como contexto em tempo real.</p>${button("Enviar arquivo", "import", "", "attach")}</div>`}</section><section class="mode-section mode-note-section"><div class="section-head"><h2>Modelo de notas</h2>${button("Adicionar modelo", "note-templates")}</div><div id="note-sections">${s.noteSections.map((section, index) => `<article class="note-section-editor"><div class="note-section-title"><input data-note-title aria-label="Título da seção ${index + 1}" maxlength="80" placeholder="Título da seção" value="${esc(section.title)}">${s.ib("close", `note-remove:${index}`, "Remover seção")}</div><textarea data-note-instructions aria-label="Instruções da seção ${index + 1}" rows="2" maxlength="3000" placeholder="Como esta seção deve ser resumida?">${esc(section.instructions)}</textarea></article>`).join("")}</div>${!s.noteSections.length ? '<div class="notes-template-empty">Notas organizadas automaticamente.<span>Adicione um modelo ou crie suas próprias seções.</span></div>' : ""}<div class="note-section-footer">${button("Adicionar seção", "note-add", "", "plus")}${button("Salvar modelo", "save-notes-template")}</div></section>${repository}<details class="mode-additional-options"><summary>Personalização e ações rápidas</summary><div class="mode-type-row"><span>Tipo de assistência</span><select data-mode-base aria-label="Tipo do modo" ${mode.builtin ? "disabled" : ""}><option value="recruiter" ${base === "recruiter" ? "selected" : ""}>Conversa e entrevista</option><option value="technical" ${base === "technical" ? "selected" : ""}>Código e entrevista técnica</option></select></div><section class="mode-section"><div class="section-head"><h2>Ações rápidas</h2>${button("Nova ação", "prompt-new", "", "plus")}</div><div class="mode-action-list">${s.actions[base].map(([key, label, i]) => `<div class="mode-action">${icon(i, 17)}<span>${label}</span><span class="action-badge">Padrão</span></div>`).join("")}${customPrompts.map((p) => `<div class="mode-action">${icon("spark", 17)}<span data-i18n-skip>${esc(p.title)}</span>${s.ib("settings", `prompt-edit:${p.id}`, "Editar ação")}${s.ib("trash", `prompt-delete:${p.id}`, "Excluir ação")}</div>`).join("")}</div></section></details>`;
  return content + advancedSystemPrompt(s);
}
