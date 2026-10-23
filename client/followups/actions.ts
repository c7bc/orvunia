import type { Draft, FollowupOptions, FollowupPlatform } from "./contracts";
import { sentDelivery } from "./boundary";
import { deliveryLabels } from "./render";
import { t } from "@cadence/i18n";
export function followupActions(
  options: FollowupOptions,
  platform: FollowupPlatform,
  operations: {
    open(): Promise<void>;
    save(form: HTMLFormElement): Promise<Draft | null>;
    review(draft: Draft): void;
  },
) {
  const form = () =>
    platform.document.querySelector<HTMLFormElement>("#followup-draft");
  return {
    async copy() {
      const target = form();
      if (!target) return;
      const draft = await operations.save(target);
      if (
        !draft ||
        !target.isConnected ||
        options.current()?.id !== target.dataset.session
      )
        return;
      await platform.copy(`${draft.subject}\n\n${draft.body}`);
      options.toast("Email copiado.");
    },
    async review() {
      const target = form();
      if (!target || !target.reportValidity()) return;
      const recipient = target.querySelector<HTMLInputElement>(
        "#followup-recipient",
      );
      if (!recipient?.value) {
        options.toast("Informe um email de destino válido.");
        recipient?.focus();
        return;
      }
      const draft = await operations.save(target);
      if (draft) operations.review(draft);
    },
    async confirm() {
      const button = platform.document.querySelector<HTMLButtonElement>(
        '[data-action="followup-send-confirm"]',
      );
      if (!button || button.disabled) return;
      const { session, revision, requestId } = button.dataset,
        workspace = options.workspace();
      if (!session || !requestId || options.current()?.id !== session) return;
      button.disabled = true;
      try {
        const delivery = sentDelivery(
          await options.api(`/sessions/${session}/followup/send`, "POST", {
            revision: Number(revision),
            requestId,
            confirmation: "send",
          }),
        );
        if (
          !button.isConnected ||
          options.workspace() !== workspace ||
          options.current()?.id !== session
        )
          return;
        options.toast(deliveryLabels[delivery.status]);
        await operations.open();
      } catch (error) {
        if (!button.isConnected || options.workspace() !== workspace) return;
        button.disabled = false;
        options.toast(
          error instanceof Error
            ? error.message
            : t("Não foi possível carregar o rascunho."),
        );
      }
    },
  };
}
