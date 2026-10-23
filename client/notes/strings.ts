import { t } from "@cadence/i18n";
export const editorStrings = () => ({
  label: t("Notas pessoais"),
  placeholder: t("Escreva suas notas aqui…"),
  source: t("Editar Markdown"),
  visual: t("Editor visual"),
  formatting: t("Formatação das notas"),
  bold: t("Negrito"),
  italic: t("Itálico"),
  heading: t("Título"),
  bulletList: t("Lista com marcadores"),
  orderedList: t("Lista numerada"),
  blockquote: t("Citação"),
  codeBlock: t("Bloco de código"),
  preserved: t(
    "Este conteúdo usa recursos avançados de Markdown. Edite o texto original para preservar toda a formatação.",
  ),
});
export const noteMessages = {
  loading: "Carregando notas…",
  unsaved: "Não salvo",
  saving: "Salvando…",
  saved: "Salvo!",
  error: "Não foi possível salvar suas notas.",
  conflict: "Estas notas foram alteradas em outra janela.",
  idle: "",
};
export const noteRegion = (field: HTMLTextAreaElement) =>
  field.closest("[data-notes-editor]") ??
  field.closest("[data-session-detail]") ??
  field.parentElement;
