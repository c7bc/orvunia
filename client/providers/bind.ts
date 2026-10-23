import type { ProviderBindings } from "./contracts";
import { providerState, providerModels } from "./contracts";
import { providerForm } from "./form";
import { escapeHtml } from "../design/html";
import { t } from "@cadence/i18n";
export function bindProviderSettings({
  state,
  api,
  toast,
  onSaved,
  root = document,
}: ProviderBindings) {
  if (state.edition === "cloud") return;
  const form = root.querySelector<HTMLFormElement>("#provider-form");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "true";
  const controls = providerForm(form),
    active = () =>
      form.isConnected && root.querySelector("#provider-form") === form;
  let saving = false;
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (
      !target ||
      !("name" in target) ||
      !("value" in target) ||
      typeof target.name !== "string" ||
      typeof target.value !== "string" ||
      !target.name.endsWith(".provider")
    )
      return;
    const kind = target.name.split(".")[0];
    if (kind === "response" || kind === "transcription")
      controls.change(kind, target.value, state);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving || !active()) return;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]');
    if (!submit) return;
    saving = true;
    submit.disabled = true;
    try {
      const next = providerState(
        await api("/providers", "PUT", {
          response: controls.connection("response"),
          transcription: controls.connection("transcription"),
        }),
      );
      if (active()) {
        toast(t("Conexões salvas."));
        await onSaved(next);
      }
    } catch (error) {
      if (active())
        toast(
          error instanceof Error
            ? error.message
            : t("Não foi possível salvar as conexões."),
        );
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });
  for (const button of form.querySelectorAll<HTMLButtonElement>(
    "[data-provider-models]",
  ))
    button.addEventListener("click", async () => {
      const kind = button.dataset.providerModels;
      if (
        (kind !== "response" && kind !== "transcription") ||
        button.disabled ||
        !active()
      )
        return;
      const result = form.querySelector(`[data-provider-result="${kind}"]`);
      if (!result) return;
      button.disabled = true;
      result.textContent = t("Consultando o provedor…");
      try {
        const payload = controls.connection(kind);
        if (!payload.model) payload.model = "catalog";
        const models = providerModels(
          await api(`/providers/${kind}/models`, "POST", payload),
        );
        if (!active()) return;
        const list = form.querySelector(`#provider-models-${kind}`);
        if (list)
          list.innerHTML = models
            .map((id) => `<option value="${escapeHtml(id)}"></option>`)
            .join("");
        result.textContent = t(
          `${models.length} modelos disponíveis. Digite ou escolha um no campo Modelo.`,
        );
      } catch (error) {
        if (active())
          result.textContent =
            error instanceof Error
              ? error.message
              : t("Não foi possível consultar modelos.");
      } finally {
        button.disabled = false;
      }
    });
}
