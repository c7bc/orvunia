import { escapeHtml as escape } from "../design/escape.js";
import { t, currentLocale } from "@cadence/i18n";
import type { BenchmarkRun, BenchmarkCase, BenchmarkTelemetry } from "./benchmark-domain.js";

const number = (value: number) => new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 3 }).format(value);
const row = (label: string, value: string) => `<dt>${escape(t(label))}</dt><dd>${escape(value)}</dd>`;
const metric = (value: number | null, unit: string, notApplicable = false) => value === null
  ? t(notApplicable ? "Não se aplica à transcrição" : "Não medido") : `${number(value)} ${unit}`;
const memory = (value: number | null) => value === null ? t("Não medido") : `${number(value / 1024 ** 2)} MiB`;
const noTokens = (sample: BenchmarkCase) => sample.capability === "transcription" && sample.telemetry !== undefined;

function unavailable(reason: string) {
  if (/not-applicable|transcription.*token|token.*transcription/.test(reason)) return t("Métricas de tokens não se aplicam à transcrição.");
  if (reason === "resident-memory:partial-probe-failure") return t("Algumas leituras de memória falharam; o valor mostrado considera somente leituras válidas.");
  if (reason === "vram:cpu-policy-unconfirmed") return t("O uso exclusivo da CPU não foi confirmado; a memória de vídeo permanece não medida.");
  if (/resident|rss|memory|process/.test(reason)) return t("Não foi possível medir a memória do processo nesta amostra.");
  if (/vram|gpu/.test(reason)) return t("A memória de vídeo não foi medida nesta amostra.");
  if (/first.*token|first.*content/.test(reason)) return t("O primeiro conteúdo recebido não foi medido nesta amostra.");
  if (/tokens|generation|timing/.test(reason)) return t("O runtime não informou contagem de tokens e tempo de geração suficientes.");
  return t("Esta medição não está disponível nesta amostra.");
}
function origin(value: string | null) {
  if (value === null) return t("Origem não registrada");
  if (value === "linux-proc-vmrss") return t("Memória residente do processo próprio amostrada no Linux (VmRSS).");
  if (value === "windows-workingset") return t("Conjunto de trabalho do processo próprio amostrado no Windows.");
  if (value === "policy-cpu-disabled") return t("Memória de vídeo considerada zero por política de CPU com offload desativado; não é leitura de sensor.");
  if (/cpu/.test(value)) return t("Execução explicitamente configurada para CPU, sem uso de memória de vídeo.");
  if (/rss|resident|process/.test(value)) return t("Memória residente amostrada do processo de execução pertencente ao aplicativo.");
  if (/sse|first.*content|first.*token/.test(value)) return t("Tempo até o primeiro conteúdo recebido pelo fluxo de resposta.");
  if (/timing|usage|token|predicted/.test(value)) return t("Contagem de tokens e tempo de geração informados pelo runtime.");
  return t("Medição informada pelo runtime; método específico não reconhecido nesta versão do cliente.");
}
function provenance(telemetry: BenchmarkTelemetry) {
  return `<details data-model-measurement-origin><summary>${escape(t("Origem das medições"))}</summary><dl>
    ${row("Primeiro conteúdo recebido", origin(telemetry.provenance.timeToFirstToken))}
    ${row("Tokens por segundo", origin(telemetry.provenance.tokensPerSecond))}
    ${row("RAM residente amostrada", origin(telemetry.provenance.residentMemory))}
    ${row("Memória de vídeo", origin(telemetry.provenance.vram))}</dl></details>`;
}
export function renderCaseMetrics(sample: BenchmarkCase) {
  const value = sample.telemetry;
  if (!value) return `<p class="settings-footnote">${escape(t("Este registro antigo não contém telemetria por amostra."))}</p>`;
  return `<div data-model-case-telemetry><dl>${row("Primeiro conteúdo recebido", metric(value.timeToFirstTokenMilliseconds, "ms", noTokens(sample)))}
    ${row("Tokens por segundo", metric(value.tokensPerSecond, "tokens/s", noTokens(sample)))}
    ${row("RAM residente amostrada", memory(value.residentMemoryBytes))}${row("Memória de vídeo", memory(value.vramBytes))}
    ${row("Tokens gerados", metric(value.generatedTokens, "tokens", noTokens(sample)))}
    ${row("Tempo de geração", metric(value.generationMilliseconds, "ms", noTokens(sample)))}
    ${row("Leituras de memória", number(value.memorySamples))}</dl>${provenance(value)}
    ${value.unavailableReasons.length ? `<ul>${[...new Set(value.unavailableReasons.map(unavailable))].map(reason => `<li>${escape(reason)}</li>`).join("")}</ul>` : ""}</div>`;
}
export function renderResultMetrics(result: NonNullable<BenchmarkRun["result"]>) {
  const transcription = result.cases.length > 0 && result.cases.every(noTokens);
  const counts = result.measurementCounts;
  return `<div data-model-result-telemetry><dl>${row("Aquecimento", metric(result.warmupMilliseconds, "ms"))}
    ${row("Primeiro conteúdo recebido", metric(result.timeToFirstTokenMilliseconds, "ms", transcription))}
    ${row("Tokens por segundo", metric(result.tokensPerSecond, "tokens/s", transcription))}
    ${row("RAM residente amostrada", memory(result.residentMemoryBytes))}${row("Memória de vídeo", memory(result.vramBytes))}</dl>
    <details data-model-measurement-method><summary>${escape(t("Como as métricas foram medidas"))}</summary>
      <p>${escape(t("O primeiro conteúdo recebido pode conter vários tokens; não mede exatamente a chegada do primeiro token."))}</p>
      <p>${escape(t("A RAM mostrada é o maior valor amostrado do processo próprio, não o pico exato nem a memória total do computador."))}</p>
      ${result.aggregation ? `<p>${escape(t("O resumo usa a média dos tempos medidos até o primeiro conteúdo, a soma dos tokens dividida pelo tempo total de geração e os maiores valores de memória registrados."))}</p>` : ""}
      ${counts ? `<dl>${row("Casos medidos: primeiro conteúdo", number(counts.timeToFirstToken))}
        ${row("Casos medidos: tokens por segundo", number(counts.tokensPerSecond))}${row("Casos medidos: RAM", number(counts.residentMemory))}
        ${row("Casos com valor: memória de vídeo", number(counts.vram))}</dl>`
        : `<p>${escape(t("Este registro antigo não informa quantos casos contribuíram para as métricas."))}</p>`}
    </details>${result.unavailableReasons.length ? `<p class="provider-hint">${escape(t("Consulte em cada amostra quais medições estão disponíveis e como foram obtidas."))}</p>` : ""}</div>`;
}
