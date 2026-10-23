import type { PanelState } from "./state.js";

export function modeProfessionalContext(state: PanelState) {
  const { esc, button, profile } = state;
  return `<section class="mode-section mode-professional-context"><div class="section-head"><h2>Seu contexto profissional</h2>${button("Editar", "profile")}</div><div class="context-preview"><h3 ${profile?.name ? "data-i18n-skip" : ""}>${esc(profile?.name || "Adicione seu perfil")}</h3><p ${profile?.experience ? "data-i18n-skip" : ""}>${esc(profile?.experience?.slice(0, 280) || "Currículo, projetos, experiências e a vaga para a qual está se preparando.")}</p></div></section>`;
}
