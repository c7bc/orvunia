import { escapeHtml as escape } from "../design/escape.js";
import { t } from "@cadence/i18n";
import type { CatalogModel } from "./domain.js";

function text(value: string | undefined) {
  return value?.trim() ? `<span data-i18n-skip>${escape(value)}</span>` : escape(t("Não informado"));
}

function link(address: string | undefined, label: string | undefined) {
  if (!address) return text(label);
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password) return text(label);
    return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer" data-model-reference data-i18n-skip>${escape(label || url.hostname + url.pathname)}</a>`;
  } catch { return text(label); }
}

export function modelMetadata(model: CatalogModel) {
  const row = (label: string, value: string) => `<dt>${escape(t(label))}</dt><dd>${value}</dd>`;
  const revision = model.revision
    ? `<code title="${escape(model.revision)}" data-i18n-skip>${escape(model.revision.slice(0, 12))}</code>`
    : text(undefined);
  return `<p class="provider-hint model-experimental">${escape(t("Experimental: a qualidade e a velocidade das respostas podem variar."))}</p>
    <details class="model-details" data-model-metadata><summary>${escape(t("Detalhes do modelo"))}</summary><dl>
      ${row("Fonte do modelo", link(model.source, undefined))}
      ${row("Licença", link(model.license?.url, model.license?.name))}
      ${row("Revisão", revision)}
      ${row("Formato do arquivo", text(model.format?.toUpperCase()))}
      ${row("Quantização", text(model.quantization))}
    </dl></details>`;
}
