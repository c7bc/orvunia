import { catalogModels, installations, jobs, hardware, runtimes } from "./decoder.js";
import { renderModels } from "./render.js";
import { activeJob } from "./domain.js";
import { object, list, string } from "../connections/domain.js";
import type { Request } from "../connections/domain.js";
import type { ModelSnapshot } from "./domain.js";
import { translateUI, t } from "@cadence/i18n";
import { modelForAction } from "./availability.js";
import { createBenchmarkController } from "./benchmark-controller.js";
export function createModelsController(options: { request: Request; changed(): void;
  openExternal?(url: string): Promise<unknown>;
  importModel?(input: { requestId: string; catalogId: string; revision: string }): Promise<unknown> }) {
  const removalRequests = new Map<string, { requestId: string; expectedRevision: number }>();
  const benchmarks = createBenchmarkController(options.request);
  let snapshot: ModelSnapshot | null = null, failure = "", busy = false, disposed = false,
    generation = 0, importing = false, timer: ReturnType<typeof setTimeout> | undefined, mount: HTMLElement | null = null;
  const visible = () => !disposed && Boolean(mount?.isConnected && !mount.closest("[hidden]"));
  function paint() {
    if (!visible() || !mount) return;
    const expanded = new Set([...mount.querySelectorAll<HTMLDetailsElement>("[data-model-metadata][open]")]
      .map(details => details.closest<HTMLElement>("[data-model-id]")?.dataset.modelId));
    const benchmarkExpanded = new Set([...mount.querySelectorAll<HTMLDetailsElement>("[data-model-benchmark-details][open]")]
      .map(details => details.dataset.modelBenchmarkDetails));
    mount.innerHTML = renderModels(snapshot, failure, busy, Boolean(options.importModel), benchmarks.view());
    for (const details of mount.querySelectorAll<HTMLDetailsElement>("[data-model-metadata]"))
      if (expanded.has(details.closest<HTMLElement>("[data-model-id]")?.dataset.modelId)) details.open = true;
    for (const details of mount.querySelectorAll<HTMLDetailsElement>("[data-model-benchmark-details]"))
      if (benchmarkExpanded.has(details.dataset.modelBenchmarkDetails)) details.open = true;
    translateUI(mount); bind(mount);
  }
  async function refresh() {
    if (disposed) return;
    const ticket = ++generation;
    clearTimeout(timer);
    try {
      const [catalog, devices, installed, pending] = await Promise.all([
        options.request("/local-models/catalog"), options.request("/local-models/hardware"),
        options.request("/local-models/installations"), options.request("/local-models/jobs"),
      ]);
      if (disposed || ticket !== generation) return;
      snapshot = { catalog: catalogModels(catalog), hardware: hardware(devices), installations: installations(installed),
        jobs: jobs(pending), runtimes: runtimes(installed), compatibility: snapshot?.compatibility ?? {} };
      await benchmarks.refresh(snapshot.installations.filter(item => item.state === "installed").map(item => item.id));
      if (disposed || ticket !== generation) return;
      const target = snapshot;
      await Promise.all(target.catalog.filter((model) => !target.compatibility[model.id]).map(async (model) => {
        try {
          const result = object(await options.request("/local-models/compatibility", "POST", {
            catalogId: model.id, revision: model.revision, contextTokens: Math.min(2048, model.maximumContext),
            enabledCapabilities: model.capabilities, simultaneousMemoryBytes: 0,
          }));
          if (disposed || ticket !== generation) return;
          target.compatibility[model.id] = { verdict: string(result.verdict), reasonCodes: list(result.reasonCodes).map(string) };
        } catch { /* Unavailable probes remain explicitly unverified. */ }
      }));
      if (disposed || ticket !== generation) return;
      failure = ""; options.changed();
    } catch (error) {
      if (disposed || ticket !== generation) return;
      failure = error instanceof Error ? error.message : "Não foi possível carregar os modelos.";
    }
    if (disposed || ticket !== generation) return;
    paint(); schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (visible() && (importing || snapshot?.jobs.some(activeJob) || benchmarks.pending())) timer = setTimeout(() => { void refresh(); }, 1000);
  }
  async function action(name: string, target: string) {
    if (busy || disposed) return;
    if (name === "refresh") { await refresh(); return; }
    if (!snapshot) return;
    busy = true; failure = ""; paint();
    try {
      const installation = snapshot.installations.find((item) => item.id === target);
      const model = modelForAction(snapshot, target);
      if (name === "benchmark-dismiss") benchmarks.dismiss();
      else if (name === "benchmark-cancel") await benchmarks.cancel(target);
      else if (name === "benchmark-confirm" || name === "benchmark-start") {
        if (!installation || installation.state !== "installed" || !snapshot.runtimes.some(item => item.installationId === installation.id))
          throw Error(t("Carregue esta instalação para iniciar um teste local."));
        if (name === "benchmark-confirm") benchmarks.confirm(target);
        else await benchmarks.start(target);
      }
      if (["download", "import", "resume"].includes(name) && (!model || model.availability === "retired"))
        throw Error(t("Este modelo foi retirado da oferta. Novos downloads, importações e retomadas estão indisponíveis."));
      if (name === "download" && model) await options.request("/local-models/downloads", "POST",
        { requestId: crypto.randomUUID(), catalogId: model.id, revision: model.revision });
      else if (name === "import" && model && options.importModel) {
        importing = true; schedule();
        try { await options.importModel({ requestId: crypto.randomUUID(), catalogId: model.id, revision: model.revision }); }
        finally { importing = false; }
      }
      else if (name === "cancel") await options.request(`/local-models/jobs/${encodeURIComponent(target)}`, "DELETE");
      else if (name === "resume") await options.request(`/local-models/jobs/${encodeURIComponent(target)}/resume`, "POST", {});
      else if (name === "load" && installation && model) await options.request(`/local-models/installations/${encodeURIComponent(target)}/load`, "POST",
        { contextTokens: Math.min(2048, model.maximumContext), maximumOutputTokens: 512,
          threads: Math.max(1, Math.min(8, snapshot.hardware.processors)) });
      else if (name === "unload" && installation) await options.request(`/local-models/installations/${encodeURIComponent(target)}/unload`, "POST", {});
      else if (name === "remove" && installation) {
        const removal = installation.removal ?? removalRequests.get(installation.id) ??
          { requestId: crypto.randomUUID(), expectedRevision: installation.revision };
        removalRequests.set(installation.id, removal);
        await options.request(`/local-models/installations/${encodeURIComponent(target)}`, "DELETE", removal);
      }
      else if (name === "compatibility" && model) {
        const result = object(await options.request("/local-models/compatibility", "POST", {
          catalogId: model.id, revision: model.revision, contextTokens: Math.min(2048, model.maximumContext),
          enabledCapabilities: model.capabilities, simultaneousMemoryBytes: 0,
        }));
        snapshot.compatibility[model.id] = { verdict: string(result.verdict), reasonCodes: list(result.reasonCodes).map(string) };
      }
      await refresh();
    } catch (error) { if (!disposed) failure = error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente."; }
    finally { busy = false; paint(); schedule(); }
  }
  function bind(root: HTMLElement) {
    mount = root;
    if (options.openExternal) for (const link of root.querySelectorAll<HTMLAnchorElement>("[data-model-reference]"))
      link.addEventListener("click", event => {
        event.preventDefault();
        void options.openExternal!(link.href).catch(() => {
          failure = "Não foi possível abrir a referência do modelo."; paint();
        });
      });
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-model-action]"))
      button.addEventListener("click", () => { void action(button.dataset.modelAction ?? "", button.dataset.modelTarget ?? ""); });
  }
  return {
    render: () => renderModels(snapshot, failure, busy, Boolean(options.importModel), benchmarks.view()),
    mount(root: HTMLElement) { bind(root); paint(); if (!snapshot) void refresh(); else schedule(); },
    choices() { return (snapshot?.installations ?? []).filter((item) => item.state === "installed").flatMap((item) => {
      const model = snapshot?.catalog.find((entry) => entry.id === item.catalogId && entry.revision === item.catalogRevision);
      return model ? [{ id: item.id, name: model.availability === "retired" ? `${model.name} — ${t("Retirado da oferta")}` : model.name,
        capabilities: model.capabilities }] : [];
    }); },
    refresh,
    dispose() { disposed = true; generation++; benchmarks.dispose(); clearTimeout(timer); mount = null; },
  };
}
