import { escapeHtml as escape } from "../design/escape.js";
import { t } from "@cadence/i18n";
import type { CatalogModel, ModelJob, ModelSnapshot } from "./domain.js";
import { activeJob } from "./domain.js";
import { compatibilityReason } from "./compatibility.js";
import { currentModelInstallation } from "./selection.js";
import { modelDownloadFailure } from "./job-failure.js";
import { modelMetadata } from "./metadata.js";
import { modelBytes, modelStates, modelVerdicts } from "./presentation.js";
import { renderBenchmark } from "./benchmark-render.js";
import type { BenchmarkView } from "./benchmark-domain.js";

function jobStatus(job: ModelJob | undefined, retired: boolean) {
  if (!job) return "";
  const percent = job.bytesTotal > 0 ? Math.min(100, job.bytesDone / job.bytesTotal * 100) : null;
  return `<p role="status">${escape(t(modelStates[job.state] ?? job.state))} ${percent === null ? "" : `${percent.toFixed(0)}%`} · ${modelBytes(job.bytesDone)}</p>
    ${activeJob(job) ? `<progress max="100" ${percent === null ? "" : `value="${percent}"`}></progress>` : ""}
    ${job.errorCode ? `<p class="notice">${escape(modelDownloadFailure(retired ? "model_retired" : job.errorCode))}</p>` : ""}`;
}

export function renderModelCard(snapshot: ModelSnapshot, model: CatalogModel, busy: boolean, nativeImport: boolean, benchmark?: BenchmarkView) {
  const { installation, job } = currentModelInstallation(snapshot, model);
  const running = installation && snapshot.runtimes.some(item => item.installationId === installation.id);
  const compatibility = snapshot.compatibility[model.id], retired = model.availability === "retired";
  const action = (name: string, label: string, target = model.id) =>
    `<button type="button" class="btn" data-model-action="${name}" data-model-target="${escape(target)}" ${busy ? "disabled" : ""}>${escape(t(label))}</button>`;
  const actions: string[] = [];
  if (job && activeJob(job)) actions.push(action("cancel", "Cancelar", job.id));
  else if (!retired && !installation) actions.push(action("download", "Baixar"));
  if (!retired && job?.retryable && !activeJob(job)) actions.push(action("resume", "Retomar", job.id));
  if (installation?.state === "installed") {
    actions.push(running ? action("unload", "Descarregar", installation.id) : action("load", "Carregar", installation.id));
    actions.push(action("remove", "Desinstalar", installation.id));
  } else if (installation && ["deleting", "failed-cleanup"].includes(installation.state))
    actions.push(action("remove", "Concluir remoção", installation.id));
  if (!retired && nativeImport && !installation && model.files.length === 1) actions.push(action("import", "Importar arquivos"));
  actions.push(action("compatibility", "Ver compatibilidade"));
  const reasons = compatibility?.reasonCodes.map(code => `<span>${escape(compatibilityReason(code))}</span>`).join(" · ")
    ?? escape(t("Verifique a compatibilidade antes de usar."));
  const status = retired ? "Retirado da oferta" : modelVerdicts[compatibility?.verdict ?? "not-verified"] ?? "Ainda não validado";
  const retirementWarning = installation
    ? "Retirado da oferta por qualidade insuficiente ou qualificação incompleta. Sua instalação e suas conexões foram preservadas."
    : "Retirado da oferta por qualidade insuficiente ou qualificação incompleta. Você pode cancelar a transferência em andamento.";
  const warning = retired ? `<p class="notice" data-model-retired>${escape(t(retirementWarning))}</p>` : "";
  const footnote = retired ? installation ? "Você pode continuar usando ou remover a instalação existente." : "Você pode cancelar a transferência em andamento."
    : "O modelo fica disponível após a verificação dos arquivos. Para usá-lo, o componente de execução precisa estar disponível.";
  const capabilities = model.capabilities.map(item => t(({ text: "Texto", vision: "Visão", transcription: "Transcrição" })[item])).join(" · ");
  return `<section class="provider-card" data-model-id="${escape(model.id)}">
    <div class="provider-card-heading"><h3>${escape(model.name)}</h3><span class="connection-status">${escape(t(status))}</span></div>
    ${warning}<p>${escape(capabilities)} · ${modelBytes(model.files.reduce((total, file) => total + file.bytes, 0))}</p>
    <p class="provider-hint">${reasons}</p>${modelMetadata(model)}${jobStatus(job, retired)}
    <div class="provider-options">${actions.join("")}</div><p class="settings-footnote">${escape(t(footnote))}</p>
    ${installation?.state === "installed" ? renderBenchmark(installation.id, Boolean(running), benchmark, busy) : ""}</section>`;
}
