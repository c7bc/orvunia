import type { OverlayState } from "./state.js";
export function renderOverlayControl(context: OverlayState) {
  const { icon, desktop } = context;

  return `<div class="control-shell"><div class="control-pill"><button class="control-brand" data-action="panel" aria-label="Abrir painel do Orvunia">${icon("orbit", 27)}</button><button class="control-toggle" data-action="chat-visibility" aria-label="${desktop.overlayVisible !== false ? "Ocultar conversa" : "Mostrar conversa"}">${icon("down", 10)}${desktop.overlayVisible !== false ? "Ocultar" : "Mostrar"}</button><button class="control-stop round" data-action="end" aria-label="Encerrar sessão">${icon("stop", 11)}</button></div></div>`;
}
