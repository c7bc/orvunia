import type { RepositoryPreview } from "./contracts.js";
import { preparationMessage } from "./preparation-messages.js";

export function renderRepositoryPreview(preview: RepositoryPreview, ports: {
  locale: string; escape(value: unknown): string; name?: string; content?: boolean;
}) {
  const esc = ports.escape;
  const t = (key: Parameters<typeof preparationMessage>[1]) => preparationMessage(ports.locale, key);
  const size = new Intl.NumberFormat(ports.locale, { maximumFractionDigits: 1 }).format(preview.bytes / 1024);
  return `<section class="repository-preview" data-repository-preview>
    ${ports.name ? `<h3 class="repository-folder" data-i18n-skip>${esc(ports.name)}</h3>` : ""}
    <p class="repository-preview-summary" data-i18n-skip>${preview.files.length} ${esc(t("fileCount"))} · ${esc(size)} KB</p>
    <ul class="repository-file-list" aria-label="${esc(t("included"))}" data-i18n-skip>${preview.files.map(file =>
      `<li><span>${esc(file.path)}</span><small>${file.lines} ${esc(t("lineCount"))}</small></li>`).join("")}</ul>
    ${ports.content === false ? "" : `<details class="repository-content"><summary>${esc(t("content"))}</summary>
      <textarea class="repository-content-text" aria-label="${esc(t("content"))}" rows="12" readonly spellcheck="false" data-i18n-skip>${esc(preview.markdown || "")}</textarea>
    </details>`}
    </section>`;
}
