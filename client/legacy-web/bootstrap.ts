import {
  errorDetails,
  requiredHealth,
  type BrowserContext,
  type LiveController,
} from "./contracts.js";

import { readHealth, readBootstrap } from "./responses.js";
export function createBootstrapMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<LiveController, "boot"> {
  return {
    async boot(this: LiveController) {
      try {
        this.health = readHealth(await ports.api.request("/health"));
        const data = readBootstrap(await ports.api.request("/bootstrap"));
        browser.preferences = {
          output: ["pt-BR", "en", "es"].includes(browser.preferences.output)
            ? browser.preferences.output
            : "pt-BR",
          audio: ["pt", "en", "es", "auto"].includes(browser.preferences.audio)
            ? browser.preferences.audio
            : "pt",
          code: browser.preferences.code || "TypeScript",
          source: browser.preferences.source || "microphone",
          instructions: browser.preferences.instructions || "",
        };
        if (data.profile) browser.profile = data.profile;
        else
          await ports.api.request("/profile", {
            method: "PUT",
            body: browser.profile,
          });
        if (data.profile) browser.preferences = data.preferences!;
        else
          await ports.api.request("/preferences", {
            method: "PUT",
            body: browser.preferences,
          });
        browser.history = data.sessions;
        browser.transcripts = { recruiter: [], technical: [] };
        browser.captures.recruiter = [];
        browser.captures.technical = [];
        browser.liveReady = true;
        const ongoing = data.sessions.find((s) => s.state !== "ended");
        if (ongoing) {
          this.sessionId = ongoing.id;
          browser.session.active = true;
          browser.session.paused = ongoing.state === "paused";
          browser.session.elapsed = ongoing.elapsed;
          browser.session.started = ongoing.date;
          browser.mode = ongoing.mode;
          browser.transcripts.recruiter = ongoing.transcripts;
          browser.transcripts.technical = ongoing.transcripts;
          browser.captures.recruiter = ongoing.captures;
          browser.captures.technical = ongoing.captures;
          for (const m of ["recruiter", "technical"] as const) {
            const r = ongoing.responses.filter((r) => r.mode === m).at(-1);
            if (r)
              this.answers[m] = {
                text: r.text,
                model: r.model,
                action: r.action,
                pending: false,
              };
          }
        }
        ports.element(".local-badge").innerHTML =
          `<span class="live-dot"></span>${requiredHealth(this).keyConfigured ? "OpenAI conectada" : "OpenAI não configurada"}`;
        ports.element(".demo-pill").textContent = "OPENAI";
        ports.element(".demo-note b").textContent = "Seu espaço de entrevistas";
        ports.element(".assistant-footnote").textContent =
          "Respostas geradas pela OpenAI · Confira os fatos";
        ports.element(".workspace-footer>span:first-child").innerHTML =
          ports.icon("shield") +
          "Áudio e contexto são enviados à OpenAI ao usar assistência.";
        ports.element(".transcript-intro").innerHTML =
          `<span class="wave-icon">${ports.icon("audio")}</span><div><b>Conversa transcrita.</b><span>Grave áudio, importe um arquivo ou adicione texto.</span></div>`;
        ports.element('[data-action="capture"]').innerHTML =
          ports.icon("capture") + "Capturar tela";
        ports
          .element("#conversation-heading")
          .closest(".panel")!
          .insertAdjacentHTML(
            "beforeend",
            `<div class="live-input-actions"><button class="secondary" data-live-action="add-text">${ports.icon("edit")}Adicionar fala</button><button class="secondary" data-live-action="upload-audio">${ports.icon("file")}Importar áudio</button></div>`,
          );
        this.bind();
        ports.renderProfile();
        ports.renderMode();
      } catch (error: unknown) {
        ports.element(".local-badge").textContent = "Servidor indisponível";
        ports.element("#assistant-body").innerHTML =
          `<h3 class="answer-title">Servidor indisponível.</h3><p class="answer-summary">Inicie o backend e recarregue esta página.</p><div class="context-warning">${ports.escape(errorDetails(error).message)}</div>`;
        ports.toast(errorDetails(error).message);
      }
    },
  };
}
