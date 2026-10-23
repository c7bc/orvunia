import { workspaceProblem, type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceActions } from "./workspace-types.js";
export function createSessionActions({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): WorkspaceActions {
  return {
    start: () => {
      if (browser.liveReady) return ports.live().start();
      if (browser.ended) workspace.resetSession();
      if (!browser.session.active) {
        browser.session.active = true;
        browser.session.paused = false;
        browser.session.started = new Date().toISOString();
        browser.ended = false;
      } else browser.session.paused = !browser.session.paused;
      workspace.renderSession();
    },
    end: workspace.endSession,
    "new-session": workspace.newSession,
    "confirm-new": () => {
      workspace.endSession();
      ports.dialog().close();
      workspace.resetSession();
    },
    capture: workspace.simulateCapture,
    assist: () => workspace.generate("assist"),
    "run-tests": workspace.runTests,
    "copy-answer": () =>
      workspace.copy(ports.element("#assistant-body").innerText),
    "copy-code": () =>
      workspace.copy(
        workspaceProblem(ports, browser.currentProblem).codes[
          browser.preferences.code
        ] ?? "",
      ),
    "copy-transcript": () =>
      workspace.copy(
        browser.transcripts[browser.mode]
          .map((t) => `${t.time} · ${t.who}: ${t.text}`)
          .join("\n\n"),
      ),
    compact: () => {
      ports.element("#compact-panel").hidden =
        !ports.element("#compact-panel").hidden;
      workspace.renderAnswer();
    },
    "close-compact": () => {
      ports.element("#compact-panel").hidden = true;
    },
    "export-session": () => {
      if (!browser.currentReport) return;
      const r = browser.currentReport;
      workspace.downloadText(
        "cadence-sessao-" + r.id + ".txt",
        `CADENCE — SESSÃO${browser.liveReady ? "" : " SIMULADA"}\n${r.title}\n${r.date}\nDuração: ${ports.formatTime(r.elapsed)}\n\n${r.transcripts.map((t) => `${t.time} ${t.who}: ${t.text}`).join("\n\n")}\n\nPergunta: ${r.question || "Nenhuma pergunta manual."}\n\n${r.responses?.map((a) => `${a.mode} · ${a.model}\n${a.text}`).join("\n\n") || ""}\n\n${browser.liveReady ? "Respostas geradas pela OpenAI. Revise os fatos." : "Dados e respostas de demonstração. Sem IA conectada."}`,
      );
      workspace.toast("Resumo exportado.");
    },
  };
}
