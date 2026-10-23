import type { Draft, Delivery, FollowupState } from "./contracts";
import { t } from "@cadence/i18n";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(t("Não foi possível carregar o rascunho."));
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum: number) {
  if (typeof value !== "string" || value.length > maximum)
    throw Error(t("Não foi possível carregar o rascunho."));
  return value;
}
function integer(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw Error(t("Não foi possível carregar o rascunho."));
  return value;
}
export function draftValue(value: unknown): Draft {
  const data = object(value);
  return {
    recipient: text(data.recipient, 254),
    subject: text(data.subject, 200),
    body: text(data.body, 30000),
    revision: integer(data.revision),
    updatedAt: text(data.updatedAt, 100),
  };
}
export function savedDraft(value: unknown) {
  return draftValue(object(value).draft);
}
export function deliveryValue(value: unknown): Delivery {
  const data = object(value),
    status = data.status;
  if (
    status !== "sending" &&
    status !== "accepted" &&
    status !== "rejected" &&
    status !== "unconfirmed"
  )
    throw Error(t("Não foi possível carregar o rascunho."));
  return {
    id: text(data.id, 100),
    revision: integer(data.revision),
    status,
    messageId: text(data.messageId, 1000),
    date: text(data.date, 100),
  };
}
export function sentDelivery(value: unknown) {
  return deliveryValue(object(value).delivery);
}
export function stateValue(value: unknown): FollowupState {
  const data = object(value),
    sending = object(data.sending);
  if (
    typeof sending.configured !== "boolean" ||
    typeof sending.allowed !== "boolean"
  )
    throw Error(t("Não foi possível carregar o rascunho."));
  return {
    draft: data.draft === null ? null : draftValue(data.draft),
    delivery: data.delivery === null ? null : deliveryValue(data.delivery),
    sending: {
      configured: sending.configured,
      allowed: sending.allowed,
      sender: text(sending.sender, 254),
      reason: text(sending.reason, 100),
      dailyLimit: integer(sending.dailyLimit),
    },
  };
}
export function localDraft(
  value: string | null,
): Pick<Draft, "recipient" | "subject" | "body"> | null {
  try {
    if (!value || value.length > 200000) return null;
    const data = object(JSON.parse(value));
    return {
      recipient: text(data.recipient ?? "", 254),
      subject: text(data.subject, 200),
      body: text(data.body, 30000),
    };
  } catch {
    return null;
  }
}
