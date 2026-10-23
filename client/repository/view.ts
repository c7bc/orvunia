import type { RepositoryUserState } from "./contracts.js";
import { repositoryMessage } from "./messages.js";
import { renderRepositoryScope } from "./scope.js";
import { renderRepositoryPreview } from "./preview.js";
import { preparationMessage } from "./preparation-messages.js";

export function renderRepository(state: RepositoryUserState, ports: {
  locale: string; escape(value: unknown): string;
}) {
  const esc = ports.escape, t = (key: Parameters<typeof repositoryMessage>[1]) => repositoryMessage(ports.locale, key);
  const preview = state.preview;
  const button = (action: string, label: string, primary = false) =>
    `<button type="button" class="btn ${primary ? "primary" : ""}" data-repository-action="${action}" ${state.busy ? "disabled" : ""}>${esc(label)}</button>`;
  const files = preview ? `<details class="repository-file-review"><summary>${esc(t("reviewFiles"))} <small>${preview.files.length} ${esc(t("files"))}</small></summary>${
    renderRepositoryPreview(preview, { ...ports, content: false })}</details>` : "";
  return `<section data-repository-view>${preview ? `
    <p>${esc(t(preview.approved ? "connected" : "consent"))}</p>${files}
    ${preview.approved ? `<p class="context-note">${esc(t("stale"))}</p>` : ""}
    <div class="form-footer">${preview.approved
      ? button("continue", t("continue"), true)
      : button("dismiss", t("later")) + button("approve", t("approve"), true)}</div>
    ${preview.approved ? `<div class="repository-secondary-actions">${button("refresh", t("refresh"))}${button("revoke", t("revoke"))}</div>` : ""}`
    : `<p>${esc(t("description"))}</p><form data-repository-form="select"><p class="context-note" data-repository-notice>${esc(preparationMessage(ports.locale, "notice"))}</p><div class="form-footer"><button class="btn primary" ${state.busy ? "disabled" : ""}>${esc(preparationMessage(ports.locale, "select"))}</button></div>${renderRepositoryScope({ ...ports, id: "repository-scope" })}</form>`}
    ${state.busy ? `<p role="status" class="context-note">${esc(t("preparing"))}</p>` : ""}
    ${state.error ? `<p role="alert" data-i18n-skip>${esc(state.error)}</p>` : ""}</section>`;
}
