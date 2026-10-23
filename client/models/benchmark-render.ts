import { escapeHtml as escape } from "../design/escape.js";
import { t, currentLocale } from "@cadence/i18n";
import type { BenchmarkRun, BenchmarkView } from "./benchmark-domain.js";
import { activeBenchmark } from "./benchmark-domain.js";
import { renderCaseMetrics, renderResultMetrics } from "./benchmark-metrics.js";

const states = { queued: "Teste na fila", running: "Teste em execução", cancelling: "Cancelando teste",
  completed: "Teste concluído", failed: "Falha no teste local", cancelled: "Teste cancelado" };
const number = (value: number) => new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 3 }).format(value);
const measured = (value: number | null, unit = "ms") => value === null ? t("Não medido") : `${number(value)} ${unit}`;

function renderRun(run: BenchmarkRun, busy: boolean) {
  const details = run.snapshot, result = run.result;
  const metric = (name: string, value: string) => `<dt>${escape(t(name))}</dt><dd>${escape(value)}</dd>`;
  const cancel = activeBenchmark(run) ? `<button type="button" class="btn" data-model-action="benchmark-cancel"
    data-model-target="${escape(run.id)}" ${busy ? "disabled" : ""}>${escape(t("Cancelar teste local"))}</button>` : "";
  return `<article data-model-benchmark-id="${escape(run.id)}"><p role="status">${escape(t(states[run.state]))}
    · <time datetime="${new Date(run.createdAt).toISOString()}">${escape(new Date(run.createdAt).toLocaleString(currentLocale()))}</time></p>${cancel}
    <p class="settings-footnote" data-i18n-skip>${escape(details.manifest.name)} · ${escape(details.manifest.quantization)}
    · ${escape(details.runtime.kind)} ${escape(details.runtime.version)}</p>
    <dl>${metric("Revisão", details.manifest.revision)}${metric("Hash do runtime", details.runtime.sha256)}
      ${metric("Contexto em tokens", number(details.settings.contextTokens))}${metric("Limite de tokens de saída", number(details.settings.maximumOutputTokens))}
      ${metric("Threads da CPU", number(details.settings.threads))}
      ${metric("Versão das amostras", details.fixtureVersion)}</dl>
    ${run.error ? `<p class="notice">${escape(t(run.state === "cancelled" ? "O teste foi cancelado. Os resultados anteriores foram preservados." : "O teste local não foi concluído. Confira a memória disponível e o modelo carregado."))}</p>` : ""}
    ${result ? `${renderResultMetrics(result)}
      ${result.cases.map(sample => `<section data-model-benchmark-case><h4>${escape(t(({ text: "Texto", vision: "Visão", transcription: "Transcrição" })[sample.capability]))}
        ${sample.language ? ` · ${escape(sample.language.toUpperCase())}` : ""}</h4>
        <p>${escape(t(sample.quality.passed ? "Amostra atendida" : "Amostra não atendida"))} · ${escape(measured(sample.latencyMilliseconds))}
        · ${sample.quality.metric === "wer" ? "WER" : escape(t("Comparação exata"))}: ${escape(number(sample.quality.value))}
        / ${escape(number(sample.quality.maximum))}</p>
        ${sample.quality.criticalTermsPreserved === false ? `<p class="notice" data-model-critical-terms>${escape(t("Termos técnicos ou negação não foram preservados. Mesmo com WER baixo, a amostra não é fiel."))}</p>` : ""}
        ${renderCaseMetrics(sample)}
        <p class="settings-footnote" data-i18n-skip>${escape(sample.fixtureId)} · ${escape(sample.fixtureSha256)}</p>
        <h5>${escape(t("Saída observada"))}</h5><pre data-i18n-skip>${escape(sample.output)}</pre>
        ${sample.outputTruncated ? `<p>${escape(t("A saída exibida foi limitada em tamanho."))}</p>` : ""}
        <h5>${escape(t("Referência da amostra"))}</h5><pre data-i18n-skip>${escape(sample.reference)}</pre></section>`).join("")}` : ""}</article>`;
}

export function renderBenchmark(installationId: string, loaded: boolean, view: BenchmarkView | undefined, busy: boolean) {
  const runs = view?.histories[installationId] ?? [], pending = runs.some(activeBenchmark);
  const confirmation = view?.confirming === installationId;
  const action = (name: string, label: string) => `<button type="button" class="btn" data-model-action="${name}"
    data-model-target="${escape(installationId)}" ${busy ? "disabled" : ""}>${escape(t(label))}</button>`;
  return `<section data-model-benchmark><h4>${escape(t("Teste local de desempenho"))}</h4>
    <p class="provider-hint">${escape(t("Usa amostras sintéticas neste computador, sem microfone, tela ou API. Pode usar a CPU; o limite do teste é de 2 minutos e o encerramento pode levar mais tempo."))}</p>
    <p class="settings-footnote">${escape(t("Os resultados valem para esta máquina e configuração. Não aprovam a qualidade geral nem reativam modelos retirados."))}</p>
    ${view?.error ? `<p class="notice">${escape(view.error)}</p>` : ""}
    ${loaded && !pending ? confirmation ? `<div data-model-benchmark-consent role="group">
      <p>${escape(t("Você autoriza executar este teste local agora?"))}</p>
      ${action("benchmark-start", "Autorizar e iniciar teste local")}${action("benchmark-dismiss", "Agora não")}</div>`
      : action("benchmark-confirm", "Preparar teste local") : !loaded && !pending ? `<p>${escape(t("Carregue esta instalação para iniciar um teste local."))}</p>` : ""}
    ${runs.length ? `<details class="model-details" data-model-benchmark-details="${escape(installationId)}" ${pending ? "open" : ""}>
      <summary>${escape(t("Histórico de testes locais"))}</summary>${runs.map(run => renderRun(run, busy)).join("")}</details>`
      : `<p class="settings-footnote">${escape(t("Nenhum teste local registrado para esta instalação."))}</p>`}</section>`;
}
