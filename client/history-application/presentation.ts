export function createRecapPresentation(ports: {
  escape(value: string): string;
  translate(value: string): string;
  button(label: string, action: string, style?: string): string;
  modal(title: string, content: string, className?: string): unknown;
}) {
  const { escape, translate: t, button, modal } = ports;
  function confirm() {
    modal(
      "Substituir as notas editadas?",
      `<p>${escape(t("O novo resumo substituirá as notas manuais somente se elas não forem alteradas durante a geração. As respostas originais permanecem no histórico."))}</p><div class="form-footer">${button(t("Cancelar"), "modal-close")}${button(t("Gerar e substituir"), "review-recap-confirm", "primary")}</div>`,
    );
  }
  function fallback(text: string, message: string) {
    modal(
      "Resumo gerado",
      `<p>${escape(t(message))}</p><p>${escape(t("Suas notas foram preservadas. Você pode copiar o resumo gerado abaixo."))}</p><textarea class="generated-recap-fallback" readonly rows="10" data-i18n-skip aria-label="${escape(t("Resumo gerado"))}">${escape(text)}</textarea><div class="form-footer">${button(t("Copiar resumo gerado"), "copy-generated-summary", "primary")}${button(t("Concluir"), "modal-close")}</div>`,
      "coding-dialog",
    );
  }
  return { confirm, fallback };
}
