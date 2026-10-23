const english = {
  title: "Report answer", recipient: "Recipient", reason: "What is wrong with this answer?",
  include: "Include the selected AI answer", context: "Selected content (editable)",
  preview: "Email draft (editable)", open: "Open email draft", copy: "Copy report",
  cancel: "Cancel", privacy: "Only the draft below is included. No audio, screenshots, full transcript or repository files are attached automatically.",
  notice: "Review and remove private information. Opening a draft does not send it; you send it from your own email app.",
  fallback: "An email app could not be opened. Copy the report and send it to support@orvunia.com.",
  copied: "Report copied. Send it using your email app.", opened: "Email draft requested. Review and send it in your email app.",
  invalid: "Add a reason and keep the draft within the allowed size. Remove unsupported control characters.",
  unavailable: "This answer is no longer available. Reopen it before reporting.",
  reasonHeading: "Reason", contentHeading: "Content selected by the user", excerpt: "Long answers are shortened in the editable selection.",
};
const portuguese: typeof english = {
  title: "Reportar resposta", recipient: "Destinatário", reason: "O que está errado nesta resposta?",
  include: "Incluir a resposta de IA selecionada", context: "Conteúdo selecionado (editável)",
  preview: "Rascunho do e-mail (editável)", open: "Abrir rascunho de e-mail", copy: "Copiar relato",
  cancel: "Cancelar", privacy: "Somente o rascunho abaixo será incluído. Áudio, capturas, transcrição completa e arquivos do repositório não são anexados automaticamente.",
  notice: "Revise e remova informações privadas. Abrir um rascunho não o envia; você envia pelo seu aplicativo de e-mail.",
  fallback: "Não foi possível abrir o aplicativo de e-mail. Copie o relato e envie para support@orvunia.com.",
  copied: "Relato copiado. Envie pelo seu aplicativo de e-mail.", opened: "Abertura do rascunho solicitada. Revise e envie pelo aplicativo de e-mail.",
  invalid: "Adicione um motivo e mantenha o rascunho dentro do limite. Remova caracteres de controle não permitidos.",
  unavailable: "Esta resposta não está mais disponível. Abra-a novamente antes de reportar.",
  reasonHeading: "Motivo", contentHeading: "Conteúdo selecionado pelo usuário", excerpt: "Respostas longas são reduzidas na seleção editável.",
};
const spanish: typeof english = {
  title: "Reportar respuesta", recipient: "Destinatario", reason: "¿Qué problema tiene esta respuesta?",
  include: "Incluir la respuesta de IA seleccionada", context: "Contenido seleccionado (editable)",
  preview: "Borrador del correo (editable)", open: "Abrir borrador de correo", copy: "Copiar reporte",
  cancel: "Cancelar", privacy: "Solo se incluye el borrador de abajo. No se adjuntan automáticamente audio, capturas, transcripción completa ni archivos del repositorio.",
  notice: "Revisa y elimina información privada. Abrir un borrador no lo envía; tú lo envías desde tu aplicación de correo.",
  fallback: "No se pudo abrir una aplicación de correo. Copia el reporte y envíalo a support@orvunia.com.",
  copied: "Reporte copiado. Envíalo desde tu aplicación de correo.", opened: "Se solicitó abrir el borrador. Revísalo y envíalo desde tu aplicación de correo.",
  invalid: "Añade un motivo y respeta el límite del borrador. Elimina los caracteres de control no permitidos.",
  unavailable: "Esta respuesta ya no está disponible. Ábrela de nuevo antes de reportarla.",
  reasonHeading: "Motivo", contentHeading: "Contenido seleccionado por el usuario", excerpt: "Las respuestas largas se acortan en la selección editable.",
};
export function reportMessages(locale: string) {
  return locale.startsWith("es") ? spanish : locale.startsWith("en") ? english : portuguese;
}
