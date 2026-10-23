import {
  workspaceProblem,
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceLayout({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<
  WorkspaceController,
  | "decorate"
  | "toast"
  | "renderProfile"
  | "renderSession"
  | "renderMode"
  | "renderAnswer"
> {
  return {
    decorate(root: ParentNode = ports.document) {
      root.querySelectorAll<HTMLElement>("[data-icon]").forEach((e) => {
        e.innerHTML = ports.icon(e.dataset.icon ?? "");
      });
    },
    toast(message: string) {
      ports.element("#toast").textContent = message;
      ports.element("#toast").classList.add("show");
      ports.window.clearTimeout(browser.toastTimeout);
      browser.toastTimeout = ports.window.setTimeout(
        () => ports.element("#toast").classList.remove("show"),
        3200,
      );
    },
    renderProfile() {
      ports.element("#candidate-name").textContent = browser.profile.name;
      ports.element("#profile-name").textContent =
        browser.profile.name.split(" ")[0] ?? "";
      ports.element("#candidate-role").textContent = browser.profile.role;
      ports.element("#job-title").textContent = browser.profile.job;
      ports.element("#job-company").textContent = browser.profile.company;
      ports.document.querySelectorAll<HTMLElement>(".avatar").forEach(
        (e) =>
          (e.textContent =
            browser.profile.name
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
              .toUpperCase() || "CV"),
      );
      ports.element("#context-tags").innerHTML = browser.profile.tags
        .split(",")
        .filter((s) => s.trim())
        .slice(0, 6)
        .map((s) => `<span>${ports.escape(s.trim())}</span>`)
        .join("");
      ports.element("#context-detail").textContent =
        browser.profile.experience.startsWith("Exemplo:")
          ? "Experiências e projetos de exemplo"
          : "Contexto personalizado";
      ports.element("#history-count").textContent = String(
        browser.history.length,
      );
    },
    renderSession() {
      if (browser.liveReady) return ports.live().renderSession();
      ports.element("#timer").textContent = ports.formatTime(
        browser.session.elapsed,
      );
      const running = browser.session.active && !browser.session.paused;
      ports.element("#session-status").classList.toggle("running", running);
      ports.element("#session-status").innerHTML =
        `<span class="status-dot"></span>${running ? "Simulação em andamento" : browser.session.paused ? "Simulação pausada" : browser.ended ? "Sessão encerrada" : "Pronto para começar"}`;
      ports.element("#start-button").innerHTML =
        ports.icon(running ? "pause" : "play") +
        (running
          ? "Pausar"
          : browser.session.paused
            ? "Retomar"
            : "Iniciar simulação");
      ports.element("#stop-button").hidden = !browser.session.active;
      ports.element("#listening-indicator").hidden = !running;
    },
    renderMode() {
      ports.document
        .querySelectorAll<HTMLElement>("[data-mode]")
        .forEach((e) =>
          e.setAttribute(
            "aria-selected",
            String(e.dataset.mode === browser.mode),
          ),
        );
      ports.element("#mode-hint").textContent =
        browser.mode === "recruiter"
          ? "Conecte suas experiências ao que a vaga precisa."
          : "Explique suas escolhas antes de escrever o código.";
      ports.element("#tip-title").textContent =
        browser.mode === "recruiter"
          ? "Uma história, não uma lista."
          : "Primeiro, entenda o problema.";
      ports.element("#tip-text").textContent =
        browser.mode === "recruiter"
          ? "Explique o desafio, sua contribuição e o impacto. Números ajudam a dar contexto."
          : "Confirme as restrições, teste um exemplo e só então escolha sua abordagem.";
      ports.field("#prompt").placeholder =
        browser.mode === "recruiter"
          ? "Peça ajuda com esta conversa…"
          : "Pergunte sobre a solução ou os trade-offs…";
      ports.element("#footer-mode").textContent =
        browser.mode === "recruiter"
          ? "Conversa com recrutador"
          : "Entrevista técnica";
      workspace.renderInput();
      workspace.renderAnswer();
      if (browser.liveReady) ports.live().renderMode();
    },
    renderAnswer() {
      ports.element("#assistant-body").innerHTML = browser.liveReady
        ? ports.live().answerHTML()
        : '<div class="loading"><span class="spinner"></span>Conectando ao servidor…</div>';
      const actions =
        browser.mode === "recruiter"
          ? [
              ["assist", "spark", "O que dizer?"],
              ["followup", "question", "Perguntar"],
              ["star", "layers", "Estruturar STAR"],
              ["recap", "list", "Resumir"],
            ]
          : [
              ["hint", "bulb", "Uma dica"],
              ["assist", "code", "Solução"],
              ["debug", "refresh", "Depurar"],
              ["design", "layers", "System design"],
            ];
      ports.element("#quick-actions").innerHTML = actions
        .map(
          ([action, i, title]) =>
            `<button data-answer="${action}" ${browser.busy || !browser.liveReady ? "disabled" : ""}>${ports.icon(i ?? "")}${title}</button>`,
        )
        .join("");
      ports.element("#compact-content").textContent = browser.liveReady
        ? ports.live().answers[browser.mode]?.text ||
          "Adicione contexto e prepare uma resposta."
        : browser.busy
          ? "Preparando exemplo…"
          : browser.mode === "recruiter"
            ? ports.optional("#assistant-body .answer-card p")?.innerText ||
              "Prepare uma resposta."
            : workspaceProblem(ports, browser.currentProblem).approach;
    },
  };
}
