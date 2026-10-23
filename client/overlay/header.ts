import type { OverlayState } from "./state.js";
import { renderAudioLabel } from "./status.js";
export function renderOverlayHeader(context: OverlayState, expanded: boolean) {
  const { ib, tab } = context;
  return `<div class="chat-collapse" ${expanded ? "" : "hidden"}>${ib("down", "collapse-chat", "Recolher respostas")}<span>${tab === "transcripts" ? "Transcrição" : tab === "context" ? "Contexto" : ""}</span><span class="grow"></span><span class="overlay-recording-status">${renderAudioLabel(context)}</span>${ib("close", "toggle-overlay", "Ocultar assistente")}</div>`;
}
