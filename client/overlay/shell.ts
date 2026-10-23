import type { OverlayState } from "./state.js";
import { renderCompactAudioStatus } from "../audio-status/render.js";
import { renderOverlayMenu } from "./menu.js";
import { renderOverlayHeader } from "./header.js";
import { renderOverlayAnswers } from "./answers.js";
import { renderCodingTools } from "./tools.js";
import { renderOverlayTranscript } from "./transcripts.js";
import { renderOverlayContext } from "./context.js";
import { isOverlayExpanded } from "./expansion.js";
export function renderOverlay(context: OverlayState) {
  const {
    current,
    modeBase,
    selectedMode,
    busy,
    tab,
    overlayMore,
    ib,
    icon,
    esc,
    draft,
  } = context;

  const mode = current?.mode || modeBase(selectedMode),
    expanded = isOverlayExpanded(context, Boolean(current && context.coding?.attempt)),
    primary =
      mode === "technical"
        ? ["assist", "hint", "debug", "design"]
        : ["assist", "say", "followup", "recap"];
  return `<div class="overlay-shell"><main class="assistant ${expanded ? "expanded" : "compact"} ${overlayMore ? "menu-open" : ""}"><div class="overlay-drag-handle" title="Arraste para mover"></div>${renderOverlayHeader(context, expanded)}<div class="answer-area" id="answer-area"><div id="answer-content">${tab === "answers" ? renderOverlayAnswers(context) : tab === "transcripts" ? renderOverlayTranscript(context) : renderOverlayContext(context)}</div></div><div class="quick-actions">${primary
    .map((key) => {
      const labels: Record<string, [string, string]> =
        mode === "technical"
          ? {
              assist: ["Resolver", "code"],
              hint: ["Pista", "spark"],
              debug: ["Depurar", "search"],
              design: ["Arquitetura", "screen"],
            }
          : {
              assist: ["Assist", "spark"],
              say: ["O que dizer?", "chat"],
              followup: ["Perguntas", "chat"],
              recap: ["Resumo", "history"],
            };
      const [title, i] = labels[key]!;
      return `<button class="chip" ${key === "say" ? 'data-quick-question="Sugira o que posso dizer a seguir, usando o contexto da conversa e meu perfil."' : `data-ask="${key}"`} ${busy ? "disabled" : ""}>${icon(i, 14)}${title}</button>`;
    })
    .join(
      "",
    )}</div>${mode !== "technical" && current?.captures.length ? `<div class="compact-capture-indicator"><span>${icon("screen", 11)}${current.captures.length} captura${current.captures.length === 1 ? "" : "s"} no contexto</span></div>` : ""}<div class="composer-wrap"><div class="composer"><textarea id="question" rows="1" maxlength="6000" placeholder="${mode === "technical" ? "Pergunte sobre o problema ou seu código…" : "Pergunte sobre sua tela ou conversa · Ctrl↵ para Assist"}" aria-label="Pergunta">${esc(draft)}</textarea><div class="composer-footer"><button class="smart-chip" data-action="overlay-more" aria-label="Smart: modo e opções">${icon("spark", 12)}Smart${icon("down", 10)}</button>${mode === "technical" ? renderCodingTools(context) : ""}${ib("dots", "overlay-more", "Mais opções")}<span class="grow"></span>${renderCompactAudioStatus(context)}${busy ? `<button class="send" data-action="cancel" aria-label="Interromper resposta">${icon("stop", 11)}</button>` : `<button class="send" data-ask="custom" aria-label="Enviar pergunta">${icon("send", 12)}</button>`}</div></div></div>${overlayMore ? renderOverlayMenu(context, mode) : ""}</main></div>`;
}
