import type { FollowupOptions, FollowupState, Draft } from "./contracts";
import { browserFollowups } from "./browser";
import { localDraft, stateValue, savedDraft } from "./boundary";
import {
  renderFollowup,
  renderFollowupReview,
  renderFollowupError,
} from "./render";
import { followupPolling } from "./poll";
import { followupActions } from "./actions";
import { t } from "@cadence/i18n";
export function createFollowupController(options: FollowupOptions) {
  const platform = options.platform ?? browserFollowups(),
    poll = followupPolling(options, platform);
  let state: FollowupState | null = null,
    generation = 0,
    sessionId = "",
    workspace = "";
  const active = (ticket: number) =>
    ticket === generation &&
    options.current()?.id === sessionId &&
    options.workspace() === workspace;
  async function open() {
    poll.cancel();
    const ticket = ++generation,
      current = options.current(),
      response = current?.responses
        .filter((value) => value.action === "email")
        .at(-1);
    state = null;
    if (!current || !response) return;
    sessionId = current.id;
    workspace = options.workspace();
    const selected = sessionId,
      key = `cadence-followup:${workspace}:${selected}`;
    let saved: ReturnType<typeof localDraft> = null;
    try {
      saved = localDraft(platform.storage.getItem(key));
    } catch {}
    const loading = options.modal(
      t("Email de acompanhamento"),
      `<p role="status">${t("Carregando rascunho…")}</p>`,
    );
    try {
      const result = stateValue(
        await options.api(`/sessions/${selected}/followup`),
      );
      if (!active(ticket) || !loading.isConnected) return;
      state = result;
      const surface = options.modal(
        t("Email de acompanhamento"),
        renderFollowup(
          result,
          result.draft ||
            saved || {
              subject: current.title,
              body: response.text,
              recipient: "",
            },
          selected,
          key,
        ),
      );
      const form = surface.querySelector<HTMLFormElement>("#followup-draft");
      if (form && result.delivery?.status === "sending")
        poll.start(selected, form);
    } catch (error) {
      if (active(ticket) && loading.isConnected)
        options.modal(t("Email de acompanhamento"), renderFollowupError(error));
    }
  }
  async function save(form: HTMLFormElement): Promise<Draft | null> {
    if (
      !state ||
      !form.reportValidity() ||
      form.dataset.saving === "true" ||
      form.dataset.session !== sessionId ||
      !active(generation)
    )
      return null;
    const ticket = generation;
    form.dataset.saving = "true";
    const buttons = [...form.querySelectorAll<HTMLButtonElement>("button")];
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      const result = savedDraft(
        await options.api(`/sessions/${sessionId}/followup`, "PUT", {
          ...platform.values(form),
          expectedRevision: Number(form.dataset.revision),
        }),
      );
      if (!active(ticket) || !form.isConnected) return null;
      form.dataset.revision = String(result.revision);
      state = { ...state, draft: result };
      try {
        if (form.dataset.key) platform.storage.removeItem(form.dataset.key);
      } catch {}
      return result;
    } finally {
      form.dataset.saving = "false";
      if (active(ticket))
        for (const button of buttons)
          button.disabled =
            button.dataset.action === "followup-send-review" &&
            !state?.sending.allowed;
    }
  }
  function review(draft: Draft) {
    if (!state?.sending.allowed || !active(generation)) return;
    poll.cancel();
    options.modal(
      t("Confirmar envio de email"),
      renderFollowupReview(
        draft,
        state.sending.sender,
        sessionId,
        options.identifier(),
      ),
    );
  }
  const actions = followupActions(options, platform, { open, save, review });
  return {
    open,
    save,
    copy: actions.copy,
    review: actions.review,
    confirm: actions.confirm,
    dispose() {
      generation++;
      state = null;
      poll.cancel();
    },
  };
}
