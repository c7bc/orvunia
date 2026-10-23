import type { OverlayState } from "./state.js";
import { renderHistoryNavigation } from "../panel/paging.js";
import { t, currentLocale } from "@cadence/i18n";
import { repositoryMessage } from "../repository/messages.js";
export function renderOverlayContext(context: OverlayState) {
  const {
    current,
    historyPager,
    esc,
    button,
    ib,
    profile,
    library,
    select,
    prefs,
  } = context;

  const page = current
    ? historyPager.page(current, "captures", { view: "overlay-captures" })
    : null;
  const technicalTools =
    current?.mode === "technical"
      ? `<div class="coding-response-actions"><button data-action="coding-context">${esc(t("Enunciado e código"))}</button><button data-action="coding-captures">${esc(t("Capturas pendentes"))} (${context.coding?.captures.length ?? 0})</button></div>`
      : "";
  const repository = `<div class="coding-response-actions"><button data-repository-action="open">${esc(repositoryMessage(currentLocale(), "title"))}</button></div>`;
  return `<div class="section-head"><h3>Contexto visual</h3>${button("Capturar", "capture", "", "screen")}${button("Capturar região", "capture-region", "", "screen")}</div>${technicalTools}${repository}${renderHistoryNavigation(null, page, "captures", "overlay-captures")}<div class="context-thumbs" data-history-list="${esc(current?.id)}|overlay-captures" data-history-page="${esc(page?.key || "")}">${page?.items.map((c) => `<div class="thumb"><img src="${esc(c.url)}" alt="Captura da sessão">${ib("close", `capture-delete:${c.id}`, "Remover captura")}<small>${esc(c.title)}</small>${current?.mode === "technical" && current?.state === "active" ? `<button class="coding-reuse-capture" data-action="coding-reuse-capture:${c.id}">${esc(t("Usar na próxima pergunta"))}</button>` : ""}</div>`).join("") || ""}</div><p class="context-note">${esc(t(current?.mode === "technical" ? "A pergunta técnica usa apenas as imagens selecionadas na fila. Reutilize uma captura do histórico pelo botão abaixo dela." : "As três capturas mais recentes são enviadas com a pergunta. Use a seleção de região para focar no enunciado."))}</p><div class="divider"></div><h3>Referências conectadas</h3><p class="context-note">${profile ? esc(profile.name + " · " + profile.role) : "Perfil ainda não preenchido."}<br>${library.documents.length} arquivos de referência · ${library.prompts.length} prompts personalizados.</p>${button("Editar contexto", "context", "", "file")}${current?.mode === "technical" ? `<div class="divider"></div><h3>Linguagem de código</h3><div style="margin-top:12px">${select("code", ["TypeScript", "JavaScript", "Python", "Java", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "SQL", "Ruby"], prefs.code)}</div>` : ""}`;
}
