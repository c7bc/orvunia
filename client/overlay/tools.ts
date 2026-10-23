import type { OverlayState } from "./state.js";
export function renderCodingTools(context: OverlayState) {
  const { current, prefs, icon, esc } = context;

  const state = current && context.coding,
    language = state?.language || prefs.code;
  return `<button class="smart-chip coding-tool" data-action="coding-context" aria-label="Enunciado e código">${icon("code", 12)}${esc(language)}</button><button class="smart-chip coding-pending" data-action="coding-captures" aria-label="Capturas pendentes">${icon("screen", 12)}${state?.captures.length || 0}</button>`;
}
