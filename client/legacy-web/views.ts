import { type BrowserContext, type LiveController } from "./contracts.js";

export function createViewsMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<
  LiveController,
  "answerHTML" | "problemHTML" | "renderInput" | "renderMode"
> {
  return {
    answerHTML(this: LiveController) {
      const a = this.answers[browser.mode];
      if (!a)
        return `<div class="empty-answer"><div class="orb">${ports.icon("spark")}</div><div class="answer-label">PRONTO QUANDO VOCÊ ESTIVER</div><h3 class="answer-title">Sua resposta começa com contexto.</h3><p class="answer-summary">Adicione uma pergunta, uma transcrição ou uma captura. Seu copiloto usa seu perfil e a vaga para ajudar.</p><p class="answer-summary">${browser.mode === "technical" ? "Escolha um desafio de prática ou envie o enunciado da sua entrevista." : "Use as ações abaixo para preparar respostas e perguntas."}</p></div>`;
      const html = ports.sanitize(ports.markdown(a.text || ""), {
        FORBID_TAGS: ["img", "iframe", "style"],
        FORBID_ATTR: ["style"],
      });
      return `<div class="answer-label">${ports.icon("spark")}RESPOSTA DA OPENAI</div>${a.pending && !a.text ? '<div class="loading"><span class="spinner"></span>Preparando resposta…</div>' : ""}<div class="generated-answer">${html}</div>${a.error ? `<div class="context-warning">${ports.escape(a.error)}</div>` : ""}<div class="answer-meta"><span>${ports.escape(a.model)}${a.pending ? " · Gerando…" : ""}</span><button class="copy-answer" data-action="copy-answer">${ports.icon("copy")}Copiar</button></div>${a.text.includes("```") ? `<button class="secondary" data-live-action="copy-generated-code">${ports.icon("copy")}Copiar código gerado</button>` : ""}`;
    },
    problemHTML(this: LiveController) {
      return this.practiceSelected
        ? ports.problemHTML()
        : `<p class="help">Biblioteca de desafios para prática</p><select class="problem-selector" id="problem-selector" aria-label="Selecionar desafio"><option value="" selected disabled>Escolher um exemplo…</option>${Object.entries(
            ports.problems,
          )
            .map(
              ([id, p]) =>
                `<option value="${id}">${ports.escape(p.title)}</option>`,
            )
            .join("")}</select>`;
    },
    renderInput(this: LiveController) {
      ports.element("#input-badge").textContent = "TRANSCRIÇÃO";
      ports.element("#captures-view").innerHTML = browser.captures[browser.mode]
        .length
        ? browser.captures[browser.mode]
            .map(
              (c) =>
                `<button class="capture-card" data-live-image="${ports.escape(c.url)}"><img src="${ports.escape(c.url)}" alt="Captura de contexto visual"><b>${ports.escape(c.title)}</b><small>${ports.escape(c.time)}</small></button>`,
            )
            .join("")
        : `<div class="capture-empty">${ports.icon("capture")}<p>Nenhuma captura nesta sessão.</p><p>Capture a tela ou importe uma imagem<br>para incluir contexto visual na próxima resposta.</p><button class="secondary" data-live-action="upload-image">Importar imagem</button></div>`;
    },
    renderMode(this: LiveController) {
      ports.optional("#live-code-language")?.remove();
      if (browser.mode === "technical")
        ports
          .element(".composer-bottom")
          .insertAdjacentHTML(
            "afterbegin",
            `<select id="live-code-language" aria-label="Linguagem de código">${["TypeScript", "JavaScript", "Python"].map((l) => `<option ${l === browser.preferences.code ? "selected" : ""}>${l}</option>`).join("")}</select>`,
          );
    },
  };
}
