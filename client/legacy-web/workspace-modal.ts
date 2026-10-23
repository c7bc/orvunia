import type { SessionReport } from "./models.js";
import {
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceModal({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<
  WorkspaceController,
  "modal" | "contextModal" | "settingsModal" | "historyModal" | "summaryModal"
> {
  return {
    modal(title: string, body: string, footer = "") {
      browser.currentReport = null;
      ports.element("#modal").setAttribute("aria-label", String(title));
      ports.element("#modal-content").innerHTML =
        `<div class="modal-header"><h2>${ports.escape(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Fechar">${ports.icon("close")}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ""}`;
      if (!ports.dialog().open) ports.dialog().showModal();
    },
    contextModal() {
      workspace.modal(
        "Seu contexto, sua história",
        `<p class="help">O exemplo inicial é fictício. Personalize com suas experiências. Os dados ficam neste navegador.</p><div class="form-grid"><div class="field"><label for="ctx-name">Nome</label><input id="ctx-name" value="${ports.escape(browser.profile.name)}" maxlength="80"></div><div class="field"><label for="ctx-role">Sua especialidade</label><input id="ctx-role" value="${ports.escape(browser.profile.role)}" maxlength="100"></div><div class="field"><label for="ctx-job">Vaga</label><input id="ctx-job" value="${ports.escape(browser.profile.job)}" maxlength="120"></div><div class="field"><label for="ctx-company">Empresa / formato</label><input id="ctx-company" value="${ports.escape(browser.profile.company)}" maxlength="100"></div></div><div class="field"><label for="ctx-tags">Tecnologias, separadas por vírgula</label><input id="ctx-tags" value="${ports.escape(browser.profile.tags)}" maxlength="200"></div><label class="import-file">Importar experiências em texto (.txt ou .md)<input id="context-file" type="file" accept=".txt,.md,text/plain,text/markdown"></label><div class="field"><label for="ctx-experience">Experiências e projetos</label><textarea id="ctx-experience" maxlength="15000">${ports.escape(browser.profile.experience)}</textarea></div><div class="field"><label for="ctx-description">Descrição da vaga</label><textarea id="ctx-description" maxlength="15000">${ports.escape(browser.profile.description)}</textarea></div>`,
        `<button class="secondary" data-action="close-modal">Cancelar</button><button class="primary" data-action="save-context">Salvar contexto</button>`,
      );
    },
    settingsModal() {
      if (browser.liveReady) return ports.live().settingsModal();
      workspace.modal(
        "Preferências",
        `<p class="help">Configure a demo. Os exemplos de recrutador e técnico estão disponíveis em português e espanhol; os exemplos básicos de recrutador também estão disponíveis em inglês.</p><div class="form-grid"><div class="field"><label for="pref-output">Idioma das respostas</label><select id="pref-output"><option value="pt-BR" ${browser.preferences.output === "pt-BR" ? "selected" : ""}>Português</option><option value="en" ${browser.preferences.output === "en" ? "selected" : ""}>English</option><option value="es" ${browser.preferences.output === "es" ? "selected" : ""}>Español</option></select></div><div class="field"><label for="pref-code">Linguagem de código</label><select id="pref-code">${["TypeScript", "JavaScript", "Python"].map((l) => `<option ${l === browser.preferences.code ? "selected" : ""}>${l}</option>`).join("")}</select></div></div><p class="help">Áudio e captura de tela são simulados nesta versão. Nenhuma permissão de microfone ou tela é solicitada.</p><button class="secondary" data-action="shortcuts">${ports.icon("keyboard")}Ver atalhos</button>`,
        `<button class="secondary" data-action="close-modal">Cancelar</button><button class="primary" data-action="save-settings">Salvar preferências</button>`,
      );
    },
    historyModal() {
      workspace.modal(
        "Suas sessões",
        browser.history.length
          ? browser.history
              .map(
                (h, i) =>
                  `<button class="history-item" data-history="${i}">${ports.icon(h.mode === "technical" ? "code" : "messages")}<span><b>${ports.escape(h.title)}</b><small>${ports.escape(new Date(h.date).toLocaleString("pt-BR"))} · ${h.mode === "technical" ? "Entrevista técnica" : "Recrutador"}</small></span><span class="right">${ports.formatTime(h.elapsed)} ${ports.icon("chevron")}</span></button>`,
              )
              .join("")
          : '<div class="capture-empty">' +
              ports.icon("history") +
              "<p>Seu histórico começa com a primeira sessão.</p><p>Inicie uma simulação e encerre para guardar o resumo.</p></div>",
      );
    },
    summaryModal(report: SessionReport) {
      workspace.modal(
        "Resumo da sessão",
        `<span class="demo-pill">${browser.liveReady ? "SESSÃO COM OPENAI" : "SESSÃO SIMULADA"}</span><h3>${ports.escape(report.title)}</h3><div class="summary-stat"><div><b>${ports.formatTime(report.elapsed)}</b><small>Tempo de prática</small></div><div><b>${report.transcripts.length}</b><small>Trechos de conversa</small></div><div><b>${report.captures.length}</b><small>${browser.liveReady ? "Capturas de contexto" : "Capturas de exemplo"}</small></div></div><p class="help">${report.mode === "technical" ? "Revise as premissas, os casos limite e a análise de complexidade." : "Prepare uma história concreta sobre suas decisões e resultados."}</p><h4>Conversa registrada</h4>${report.transcripts.map((t) => `<div class="transcript-item"><div class="transcript-meta">${ports.escape(t.who)}<time>${ports.escape(t.time)}</time></div><p>${ports.escape(t.text)}</p></div>`).join("")}${report.question ? `<h4>Sua última pergunta</h4><p>${ports.escape(report.question)}</p>` : ""}`,
        `<button class="secondary" data-action="export-session">${ports.icon("download")}Exportar resumo</button><button class="primary" data-action="close-modal">Concluir</button>`,
      );
      browser.currentReport = report;
      if (browser.liveReady && report.responses?.length) {
        ports
          .element(".modal-body")
          .insertAdjacentHTML(
            "beforeend",
            "<h4>Respostas guardadas</h4>" +
              report.responses
                .map(
                  (r) =>
                    `<div class="summary-answer"><small>${ports.escape(r.mode === "technical" ? "Técnico" : "Recrutador")} · ${ports.escape(r.model)}</small><div class="generated-answer">${ports.sanitize(ports.markdown(r.text), { FORBID_TAGS: ["img", "iframe", "style"], FORBID_ATTR: ["style"] })}</div></div>`,
                )
                .join(""),
          );
      }
    },
  };
}
