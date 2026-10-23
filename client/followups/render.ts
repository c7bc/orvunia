import { t } from "@cadence/i18n";
import type { Draft, Delivery, FollowupState } from "./contracts";
const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => escapes[character]!);
export const deliveryLabels: Record<Delivery["status"], string> = {
  accepted: "Email aceito pelo servidor de envio.",
  rejected: "O servidor recusou o email. Revise o destino e o rascunho.",
  unconfirmed:
    "Não foi possível confirmar o envio. Ele não será repetido automaticamente.",
  sending: "Envio em andamento…",
};
const reasons: Record<string, string> = {
  disabled: "O envio de email está desativado nesta instalação.",
  "not-configured": "O envio de email não está configurado nesta instalação.",
  "verification-required": "Confirme seu email antes de enviar mensagens.",
};
export function renderFollowup(
  state: FollowupState,
  draft: Pick<Draft, "recipient" | "subject" | "body">,
  sessionId: string,
  key: string,
) {
  return `<form id="followup-draft" data-session="${esc(sessionId)}" data-key="${esc(key)}" data-revision="${state.draft?.revision || 0}"><div class="fields"><div class="field full"><label for="followup-recipient">${esc(t("Destinatário"))}</label><input type="email" id="followup-recipient" name="recipient" maxlength="254" autocomplete="email" value="${esc(draft.recipient)}"></div><div class="field full"><label for="followup-subject">${esc(t("Assunto"))}</label><input id="followup-subject" name="subject" maxlength="200" value="${esc(draft.subject)}" required></div><div class="field full"><label for="followup-body">${esc(t("Mensagem"))}</label><textarea id="followup-body" name="body" rows="8" maxlength="30000" required>${esc(draft.body)}</textarea></div></div><p>${esc(t("Revise o rascunho antes de usar no seu email."))}</p><p role="status" data-followup-delivery ${state.delivery ? "" : "hidden"}>${state.delivery ? esc(t(deliveryLabels[state.delivery.status])) : ""}</p>${!state.sending.allowed ? `<p class="context-note">${esc(t(reasons[state.sending.reason] || reasons["not-configured"]!))}</p>` : `<p class="context-note">${esc(t("Enviado por"))}: <span data-i18n-skip>${esc(state.sending.sender)}</span></p>`}<div class="form-footer"><button class="btn" type="submit">${esc(t("Salvar rascunho"))}</button><button class="btn" type="button" data-action="followup-copy">${esc(t("Copiar email"))}</button><button class="btn primary" type="button" data-action="followup-send-review" ${state.sending.allowed ? "" : "disabled"}>${esc(t("Revisar envio"))}</button></div></form>`;
}
export function renderFollowupReview(
  draft: Draft,
  sender: string,
  sessionId: string,
  requestId: string,
) {
  return `<p>${esc(t("Confira o destino e a mensagem. O envio só acontece ao confirmar abaixo."))}</p><dl><dt>${esc(t("Enviado por"))}</dt><dd data-i18n-skip>${esc(sender)}</dd><dt>${esc(t("Destinatário"))}</dt><dd data-i18n-skip>${esc(draft.recipient)}</dd><dt>${esc(t("Assunto"))}</dt><dd data-i18n-skip>${esc(draft.subject)}</dd></dl><pre class="followup-preview" data-i18n-skip>${esc(draft.body)}</pre><div class="form-footer"><button class="btn" data-action="followup-email">${esc(t("Voltar ao rascunho"))}</button><button class="btn primary" data-action="followup-send-confirm" data-session="${esc(sessionId)}" data-revision="${draft.revision}" data-request-id="${esc(requestId)}">${esc(t("Enviar email"))}</button></div>`;
}
export const renderFollowupError = (error: unknown) =>
  `<p role="alert">${esc(error instanceof Error ? error.message : t("Não foi possível carregar o rascunho."))}</p><div class="form-footer"><button class="btn" data-action="followup-email">${esc(t("Tentar novamente"))}</button></div>`;
