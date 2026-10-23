import { escapeHtml as escape } from "../design/escape.js";
import { t } from "@cadence/i18n";
import type { ModelSnapshot } from "./domain.js";
import { visibleModelCatalog } from "./availability.js";
import { renderModelCard } from "./card.js";
import { modelBytes } from "./presentation.js";
import type { BenchmarkView } from "./benchmark-domain.js";

export function renderModels(value: ModelSnapshot | null, error = "", busy = false, nativeImport = false, benchmark?: BenchmarkView) {
  if (!value) return `<p role="status">${escape(t(error || "Carregando modelos…"))}</p>
    <button type="button" class="btn" data-model-action="refresh">Atualizar</button>`;
  const catalog = visibleModelCatalog(value), available = catalog.some(model => model.availability !== "retired");
  const description = available ? "Modelos leves, armazenados neste computador. O desempenho depende da sua máquina."
    : "Gerencie os modelos já instalados neste computador.";
  const disk = value.hardware.freeDiskBytes === null ? t("Espaço livre não medido")
    : `${modelBytes(value.hardware.freeDiskBytes)} ${t("livres")}`;
  const empty = available ? "" : `<section class="notice" role="status" data-model-catalog-empty>
    <p>${escape(t("Não há modelos disponíveis para baixar no momento."))}</p>
    <p>${escape(t("Nenhum candidato concluiu a qualificação de qualidade."))}</p>
    <p>${escape(t("Configure suas conexões de API acima para texto, visão e transcrição."))}</p></section>`;
  return `<header class="settings-heading"><h2>${escape(t("Modelos locais"))}</h2><p>${escape(t(description))}</p></header>
    <p class="settings-footnote">${value.hardware.processors} ${t("processadores")} · ${modelBytes(value.hardware.totalMemoryBytes)} RAM · ${escape(disk)}</p>
    ${error ? `<p role="alert" class="notice">${escape(error)}</p>` : ""}${empty}
    ${catalog.map(model => renderModelCard(value, model, busy, nativeImport, benchmark)).join("")}`;
}
