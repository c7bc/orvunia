import { t } from "@cadence/i18n";
import type { Request } from "../connections/domain.js";
import type { BenchmarkRun, BenchmarkView } from "./benchmark-domain.js";
import { activeBenchmark } from "./benchmark-domain.js";
import { benchmarkHistory, benchmarkRun } from "./benchmark-decoder.js";

export function createBenchmarkController(request: Request) {
  let view: BenchmarkView = { histories: {}, confirming: null, error: "" }, generation = 0, disposed = false;
  const pendingRequests = new Map<string, string>();
  const retain = (run: BenchmarkRun) => {
    view.histories[run.installationId] = [run, ...(view.histories[run.installationId] ?? []).filter(item => item.id !== run.id)].slice(0, 20);
  };
  return {
    view: () => view,
    pending: () => Object.values(view.histories).some(runs => runs.some(activeBenchmark)),
    confirm(installationId: string) { view.confirming = installationId; },
    dismiss() { view.confirming = null; },
    async refresh(installationIds: string[]) {
      const ticket = ++generation;
      const histories: Record<string, BenchmarkRun[]> = {};
      try {
        await Promise.all(installationIds.map(async id => {
          const runs = benchmarkHistory(await request(`/local-models/installations/${encodeURIComponent(id)}/benchmarks`));
          if (runs.some(run => run.installationId !== id)) throw Error("Resposta inválida do servidor.");
          histories[id] = runs;
        }));
        if (!disposed && ticket === generation) view = { ...view, histories, error: "" };
      } catch { if (!disposed && ticket === generation) view.error = t("Não foi possível carregar os testes locais."); }
    },
    async start(installationId: string) {
      if (disposed || view.confirming !== installationId) throw Error(t("Confirme o teste local antes de iniciar."));
      const requestId = pendingRequests.get(installationId) ?? crypto.randomUUID(); pendingRequests.set(installationId, requestId);
      const run = benchmarkRun(await request(`/local-models/installations/${encodeURIComponent(installationId)}/benchmark`, "POST", { requestId, consent: true }));
      if (run.installationId !== installationId || run.requestId !== requestId) throw Error("Resposta inválida do servidor.");
      if (!disposed) { retain(run); pendingRequests.delete(installationId); view.confirming = null; }
    },
    async cancel(id: string) {
      const existing = Object.values(view.histories).flat().find(run => run.id === id);
      if (!existing || !activeBenchmark(existing)) return;
      const run = benchmarkRun(await request(`/local-models/benchmarks/${encodeURIComponent(id)}`, "DELETE"));
      if (run.id !== id || run.installationId !== existing.installationId) throw Error("Resposta inválida do servidor.");
      if (!disposed) retain(run);
    },
    dispose() { disposed = true; generation++; },
  };
}
