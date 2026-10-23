import type { ProfileContext } from "./compatibility-types.js";
export function renderProfileForm(context: ProfileContext, modal = true) {
  const profileValue = context.profile || {},
    { escape, button } = context;
  const fields: readonly (readonly [string, string, string])[] = [
    ["name", "Nome completo", "Seu nome"],
    ["role", "Área profissional", "Ex.: Engenharia de software"],
    ["job", "Cargo da vaga", "Ex.: Desenvolvedor backend"],
    ["company", "Empresa", "Opcional"],
    ["tags", "Tecnologias e termos", "Ex.: TypeScript, filas, PostgreSQL"],
  ];
  return `<form id="profile-form"><div class="fields">${fields
    .map(
      ([key, label, placeholder]) =>
        `<div class="field ${key === "tags" ? "full" : ""}"><label for="p-${key}">${label}</label><input id="p-${key}" name="${key}" value="${escape(profileValue[key])}" placeholder="${placeholder}" ${["name", "role", "job"].includes(key) ? "required" : ""} maxlength="${key === "tags" ? 200 : key === "name" ? 80 : key === "job" ? 120 : 100}"></div>`,
    )
    .join(
      "",
    )}<div class="field full"><label for="p-experience">Experiências, projetos e resultados reais</label><textarea id="p-experience" name="experience" rows="4" maxlength="15000" placeholder="Conte o que você fez. Inclua decisões, desafios e resultados que possa sustentar.">${escape(profileValue.experience)}</textarea></div><div class="field full"><label for="p-description">Descrição da vaga</label><textarea id="p-description" name="description" rows="3" maxlength="15000">${escape(profileValue.description)}</textarea></div></div><div class="form-footer">${modal ? button("Cancelar", "modal-close") : ""}<button class="btn primary" type="submit">Salvar contexto</button></div></form>`;
}
