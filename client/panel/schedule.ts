import type { PanelState } from "./state.js";

export function renderScheduleForm(s: PanelState) {
  return `<form id="schedule-form"><div class="fields"><div class="field full"><label>Título<input name="title" required maxlength="200"></label></div><div class="field full"><label>Data e hora<input type="datetime-local" name="date" required></label></div><div class="field full"><label>Modo<select name="mode" aria-label="Modo">${s.modes.map((mode) => `<option data-i18n-skip value="${s.esc(mode.id)}" ${mode.id === s.selectedMode ? "selected" : ""}>${s.esc(s.modeName(mode.id))}</option>`).join("")}</select></label></div></div><div class="form-footer"><button class="btn primary">Salvar lembrete</button></div></form>`;
}
