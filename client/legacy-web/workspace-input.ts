import {
  workspaceProblem,
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceInput({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<
  WorkspaceController,
  "problemTranscript" | "renderInput" | "problemHTML"
> {
  return {
    problemTranscript(id: string) {
      const lines =
        id === "parentheses"
          ? [
              "Vamos verificar se os parênteses, colchetes e chaves de uma string estão corretamente aninhados.",
              "Uma pilha pode representar a ordem das aberturas. Uma string vazia deve ser considerada válida?",
              "Sim. Explique também os casos com um fechamento sem abertura e com delimitadores fora de ordem.",
            ]
          : id === "binary-search"
            ? [
                "Encontre um alvo em um array ordenado em tempo logarítmico. Retorne −1 quando ele não existir.",
                "Vou manter os limites do intervalo e comparar o elemento central com o alvo. O array pode estar vazio?",
                "Pode. Considere também um único elemento e o alvo nas extremidades.",
              ]
            : ports.data.initialTranscripts.technical.map((t) => t.text);
      return lines.map((text, i) => ({
        text,
        who: i === 1 ? "Você" : "Entrevistador",
        time: ["00:10", "00:24", "00:36"][i]!,
      }));
    },
    renderInput() {
      const tech = browser.mode === "technical";
      ports.element("#conversation-heading").innerHTML =
        ports.icon(tech ? "code" : "audio") +
        (tech ? "Problema & conversa" : "Conversa");
      ports.element("#input-badge").textContent = tech
        ? "ENUNCIADO DE EXEMPLO"
        : "ÁUDIO SIMULADO";
      ports.element("#transcript-list").innerHTML =
        (tech
          ? browser.liveReady
            ? ports.live().problemHTML()
            : workspace.problemHTML()
          : "") +
        browser.transcripts[browser.mode]
          .map(
            (t) =>
              `<div class="transcript-item"><div class="transcript-meta"><span class="speaker-dot ${t.who === "Você" ? "me" : ""}">${t.who === "Você" ? "V" : "E"}</span>${ports.escape(t.who)}<time>${ports.escape(t.time)}</time></div><p>${ports.escape(t.text)}</p></div>`,
          )
          .join("");
      ports.element(".transcript-intro").hidden = tech;
      ports.element("#capture-count").textContent = String(
        browser.captures[browser.mode].length,
      );
      ports.element("#transcript-view").hidden =
        browser.inputTab !== "transcript";
      ports.element("#captures-view").hidden = browser.inputTab !== "captures";
      ports.document
        .querySelectorAll<HTMLElement>("[data-input-tab]")
        .forEach((e) => {
          e.classList.toggle("active", e.dataset.inputTab === browser.inputTab);
          e.setAttribute(
            "aria-selected",
            String(e.dataset.inputTab === browser.inputTab),
          );
        });
      ports.element("#captures-view").innerHTML = browser.captures[browser.mode]
        .length
        ? browser.captures[browser.mode]
            .map(
              (c, i) =>
                `<button class="capture-card" data-capture="${i}"><div class="capture-preview">${ports.escape(c.preview).replace(/\n/g, "<br>")}</div><b>${ports.escape(c.title)}</b><small>${ports.escape(c.time)} · Captura de exemplo</small></button>`,
            )
            .join("")
        : `<div class="capture-empty">${ports.icon("capture")}<p>Nenhuma captura nesta sessão.</p><p>Use “Simular captura” para adicionar<br>um exemplo de contexto visual.</p></div>`;
      if (browser.liveReady) ports.live().renderInput();
      workspace.renderSession();
    },
    problemHTML() {
      const p = workspaceProblem(
        ports,
        browser.currentProblem,
        browser.preferences.output,
      );
      return `<select class="problem-selector" aria-label="Selecionar desafio" id="problem-selector">${Object.entries(
        ports.data.problems,
      )
        .map(
          ([id, p]) =>
            `<option value="${id}" ${id === browser.currentProblem ? "selected" : ""}>${ports.escape(p.title)}</option>`,
        )
        .join(
          "",
        )}</select><div class="problem-title">${ports.escape(p.title)}<span class="difficulty">Fundamentos</span></div><p class="problem-body">${ports.escape(p.desc)}</p><div class="example-box">Entrada: ${ports.escape(p.input)}<br>Saída: ${ports.escape(p.output)}</div><p class="problem-constraints"><b>Premissas</b><br>${ports.escape(p.constraints)}</p><div class="divider" style="margin:18px 0"></div>`;
    },
  };
}
