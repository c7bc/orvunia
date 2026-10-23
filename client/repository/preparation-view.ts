import { preparationMessage } from "./preparation-messages.js";
import type { RepositoryPreview } from "./contracts.js";
import { renderRepositoryScope } from "./scope.js";
export type PreparedRepository = { modeId: string; name: string; preview: RepositoryPreview; authorized?: boolean };
export function renderModeRepository(ports: {
  modeId: string; locale: string; native: boolean; prepared: PreparedRepository | null;
  escape(value: unknown): string; icon(name: string, size: number): string;
}) {
  const esc = ports.escape, t = (key: Parameters<typeof preparationMessage>[1]) => preparationMessage(ports.locale, key);
  const action = (key: string, label: string) => `<button type="button" class="btn" data-repository-preparation="${key}" data-mode-id="${esc(ports.modeId)}" ${!ports.native ? "disabled" : ""}>${esc(label)}</button>`;
  return `<section class="mode-section mode-repository-section" data-component="mode-repository">
    <div class="section-head"><h2>${esc(t("title"))}</h2><button type="button" class="icon-btn" data-repository-preparation="info" data-mode-id="${esc(ports.modeId)}" aria-label="${esc(t("info"))}" title="${esc(t("info"))}">${ports.icon("info", 17)}</button></div>
    <p class="context-note">${esc(t("description"))}</p>
    <div class="context-preview"><strong data-i18n-skip>${esc(ports.prepared?.name || t("empty"))}</strong>${ports.prepared ? `<p data-i18n-skip>${esc(t("ready"))} · ${ports.prepared.preview.files.length}</p>` : ""}</div>
    <p class="context-note">${esc(t(ports.native ? "lifetime" : "unavailable"))}</p>
    ${ports.native ? `<p class="context-note" data-repository-notice>${esc(t("notice"))}</p>` : ""}
    ${ports.prepared && !ports.prepared.authorized ? `<p class="context-note">${esc(t("reconnect"))}</p>` : ""}
    <div class="form-footer">${action("select", t(ports.prepared?.authorized ? "change" : "select"))}${ports.prepared ? action("review", t("review")) + action("remove", t("remove")) : ""}</div>
    ${ports.native ? renderRepositoryScope({ ...ports, id: `repository-scope-${ports.modeId}` }) : ""}
    </section>`;
}
