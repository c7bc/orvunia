import { readConnections } from "./decoder.js";
import { renderConnections } from "./render.js";
import { connectionInput } from "./form.js";
import { createModelsController } from "../models/controller.js";
import { object, list, string } from "./domain.js";
import type { Configuration, Capability, Request } from "./domain.js";
import { t } from "@cadence/i18n";
export function createConnectionPanel(options: { request: Request; changed(): void; toast(message: string): void;
  openExternal?(url: string): Promise<unknown>;
  importModel?(input: { requestId: string; catalogId: string; revision: string }): Promise<unknown> }) {
  let configuration: Configuration | null = null, failure = "", disposed = false, generation = 0, busy = false, unsupported = false,
    mounted: Element | null = null;
  const models = createModelsController({ request: options.request, changed: refreshChoices,
    ...(options.openExternal ? { openExternal: options.openExternal } : {}),
    ...(options.importModel ? { importModel: options.importModel } : {}) });
  function refreshChoices() {
    if (!active()) return;
    for (const select of mounted!.querySelectorAll<HTMLSelectElement>('[name$=".installation"]')) {
      const capability = select.name.split(".")[0] as Capability, selected = select.value;
      select.replaceChildren();
      const empty = select.ownerDocument.createElement("option");
      empty.value = ""; empty.textContent = t("Selecione um modelo instalado"); select.append(empty);
      for (const choice of models.choices().filter((item) => item.capabilities.includes(capability))) {
        const option = select.ownerDocument.createElement("option"); option.value = choice.id; option.textContent = choice.name;
        select.append(option);
      }
      select.value = selected;
    }
  }
  const active = () => !disposed && Boolean(mounted?.isConnected);
  async function refresh() {
    const ticket = ++generation;
    try {
      const result = readConnections(await options.request("/ai/connections"));
      await models.refresh();
      if (disposed || ticket !== generation) return;
      configuration = result; failure = "";
    } catch (error) {
      if (disposed || ticket !== generation) return;
      if (error && typeof error === "object" && "status" in error && error.status === 404) unsupported = true;
      failure = error instanceof Error ? error.message : t("Não foi possível carregar as conexões.");
    }
    if (active()) options.changed();
  }
  async function probe(form: HTMLFormElement, button: HTMLButtonElement) {
    const capability = (button.dataset.connectionTest ?? button.dataset.connectionModels) as Capability;
    const card = button.closest("[data-connection-card]"), result = card?.querySelector("[data-connection-result]");
    const selected = form.querySelector<HTMLSelectElement>(`[name="${capability}.connection"]`)?.value;
    if (!result || !selected) return;
    if (selected === "new") { result.textContent = t("Salve a conexão antes de testar ou listar modelos."); return; }
    button.disabled = true;
    try {
      if (button.dataset.connectionTest) {
        const value = object(await options.request(`/ai/connections/${encodeURIComponent(selected)}/test`, "POST", {}));
        if (active() && result.isConnected) result.textContent = t(value.ready === true ? "Conexão pronta." : "Conexão indisponível.");
      } else {
        const value = object(await options.request(`/ai/connections/${encodeURIComponent(selected)}/models`));
        if (active() && result.isConnected) result.textContent = list(value.models).map((item) => string(object(item).id)).join(" · ");
      }
    } catch (error) { if (active() && result.isConnected) result.textContent = error instanceof Error ? error.message : t("Conexão indisponível."); }
    finally { button.disabled = false; }
  }
  function bind(root: Document | HTMLElement) {
    const host = root.querySelector<HTMLElement>("[data-connections-v2]");
    if (!host || host.dataset.bound || disposed) return;
    mounted = host; host.dataset.bound = "true";
    host.querySelector("[data-connections-refresh]")?.addEventListener("click", () => { void refresh(); });
    const form = host.querySelector<HTMLFormElement>("[data-connections-form]");
    form?.addEventListener("change", (event) => {
      const field = event.target as HTMLSelectElement | null;
      if (!field?.name) return;
      const card = field.closest("[data-connection-card]");
      if (field.name.endsWith(".kind")) {
        card?.querySelector<HTMLElement>("[data-connection-api]")?.toggleAttribute("hidden", field.value !== "api");
        card?.querySelector<HTMLElement>("[data-connection-local]")?.toggleAttribute("hidden", field.value !== "local");
      }
      if (field.name.endsWith(".connection")) {
        const connection = configuration?.connections.find((item) => item.id === field.value);
        if (connection) for (const key of ["provider", "baseUrl", "model"] as const) {
          const input = card?.querySelector<HTMLInputElement>(`[name$=".${key}"]`); if (input) input.value = connection[key];
        }
        const vision = card?.querySelector<HTMLInputElement>('[name="text.vision"]');
        if (vision) vision.checked = connection?.capabilities.includes("vision") ?? false;
        const tokens = card?.querySelector<HTMLInputElement>('[name="text.maxTokens"]');
        if (tokens) tokens.value = String(connection?.parameters.maxTokens ?? 3000);
        const password = card?.querySelector<HTMLInputElement>('[type="password"]'); if (password) password.value = "";
      }
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault(); event.stopPropagation(); if (busy || !configuration || !active()) return;
      busy = true;
      try {
        const result = readConnections(await options.request("/ai/connections", "PUT", connectionInput(form, configuration)));
        if (!active()) return;
        configuration = result; failure = ""; options.toast(t("Conexões salvas.")); options.changed();
      } catch (error) { if (active()) { failure = error instanceof Error ? error.message : t("Não foi possível salvar as conexões."); options.toast(failure); } }
      finally { busy = false; }
    });
    for (const button of host.querySelectorAll<HTMLButtonElement>("[data-connection-test],[data-connection-models]"))
      button.addEventListener("click", () => { if (form) void probe(form, button); });
    host.querySelector("[data-models-toggle]")?.addEventListener("click", () => {
      const mount = host.querySelector<HTMLElement>("[data-models-mount]");
      if (mount) { mount.hidden = !mount.hidden; if (!mount.hidden) models.mount(mount); }
    });
    if (!configuration && !failure) void refresh();
  }
  return { render: () => unsupported ? "" : renderConnections(configuration, models.choices(), failure), bind, refresh,
    dispose() { disposed = true; generation++; mounted = null; models.dispose(); } };
}
