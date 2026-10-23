import {
  workspaceProblem,
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceLifecycle({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<
  WorkspaceController,
  | "cancelGeneration"
  | "generate"
  | "endSession"
  | "newSession"
  | "resetSession"
  | "simulateCapture"
> {
  return {
    cancelGeneration() {
      browser.busyToken++;
      browser.busy = false;
      if (browser.liveReady) ports.live().cancel();
    },
    async generate(kind = "assist") {
      if (!browser.liveReady) {
        workspace.toast("O servidor ainda não está conectado.");
        return;
      }
      if (browser.liveReady) return ports.live().generate(kind);
      if (browser.busy) return;
      const token = ++browser.busyToken;
      browser.busy = true;
      browser.answerKind = kind;
      if (kind === "debug") browser.codeTab = "reasoning";
      workspace.renderAnswer();
      await new Promise((r) => ports.window.setTimeout(r, 600));
      if (token !== browser.busyToken) return;
      browser.busy = false;
      workspace.renderAnswer();
    },
    endSession() {
      if (browser.liveReady) return ports.live().end();
      if (!browser.session.active) return;
      browser.session.active = false;
      browser.session.paused = false;
      browser.ended = true;
      const report = {
        id: Date.now(),
        date: new Date().toISOString(),
        title:
          browser.profile.job +
          " · " +
          (browser.mode === "technical"
            ? workspaceProblem(ports, browser.currentProblem).title
            : "Trajetória & projetos"),
        mode: browser.mode,
        elapsed: browser.session.elapsed,
        transcripts: [...browser.transcripts[browser.mode]],
        captures: [...browser.captures[browser.mode]],
        question: browser.customQuestion,
      };
      browser.history.unshift(report);
      browser.history = browser.history.slice(0, 30);
      ports.storage.write("history", browser.history);
      workspace.renderProfile();
      workspace.renderSession();
      workspace.summaryModal(report);
    },
    newSession() {
      if (browser.liveReady) return ports.live().newSession();
      if (browser.session.active) {
        workspace.modal(
          "Começar uma nova sessão?",
          `<p class="answer-summary">A sessão atual será encerrada e salva no histórico antes de começar outra.</p>`,
          `<button class="secondary" data-action="close-modal">Continuar sessão</button><button class="primary" data-action="confirm-new">Salvar e começar outra</button>`,
        );
        return;
      }
      workspace.resetSession();
    },
    resetSession() {
      workspace.cancelGeneration();
      Object.assign(browser.session, {
        active: false,
        paused: false,
        elapsed: 0,
        started: null,
        extraIndex: 0,
      });
      browser.ended = false;
      browser.transcripts = {
        recruiter: [...ports.data.initialTranscripts.recruiter],
        technical: workspace.problemTranscript(browser.currentProblem),
      };
      browser.captures.recruiter = [];
      browser.captures.technical = [];
      browser.answerKind = "assist";
      browser.customQuestion = "";
      browser.inputTab = "transcript";
      browser.testsRun = false;
      browser.codeTab = "code";
      ports.field("#prompt").value = "";
      workspace.renderMode();
      workspace.toast("Nova sessão pronta.");
    },
    simulateCapture() {
      if (browser.liveReady) return ports.live().capture();
      const p = workspaceProblem(ports, browser.currentProblem);
      browser.captures[browser.mode].push({
        title: browser.mode === "technical" ? p.title : "Contexto da conversa",
        time: ports.formatTime(browser.session.elapsed),
        preview:
          browser.mode === "technical"
            ? p.title + "\n" + p.input + "\nSaída: " + p.output
            : browser.profile.job +
              "\n" +
              browser.profile.tags +
              "\nProjeto · decisão · impacto",
      });
      browser.inputTab = "captures";
      workspace.renderInput();
      workspace.toast("Captura de exemplo adicionada.");
    },
  };
}
