import type { ApplicationState } from "../application/model.js";
import type { ApplicationStorage } from "../application/storage.js";
import type { ModeResult } from "../commands/model.js";
import { modeResult, readMode } from "../commands/boundary.js";
import { record } from "../legacy-web/validation.js";
import type { ApplicationRequest } from "./contracts.js";
import { serializeNoteSections, type NoteSection } from "./sections.js";
export function createApplicationModes(ports: {
  state: ApplicationState;
  document: Document;
  storage: ApplicationStorage;
  request: ApplicationRequest;
  changed(): void;
  render(): void;
}) {
  const { state, document } = ports;
  function apply(result: ModeResult) {
    state.modes = result.modes;
    state.selectedMode = result.activeId;
    if (result.templates) state.modeTemplates = result.templates;
    ports.storage.setItem("cadence-selected-mode", state.selectedMode);
  }
  function readSections() {
    return [...document.querySelectorAll(".note-section-editor")].map(
      (element) => ({
        title:
          element.querySelector<HTMLInputElement>("[data-note-title]")!.value,
        instructions: element.querySelector<HTMLTextAreaElement>(
          "[data-note-instructions]",
        )!.value,
      }),
    );
  }
  return {
    apply,
    async activate(modeId: string) {
      const workspace = state.workspaceKey;
      const result = modeResult(
        await ports.request(`/modes/${modeId}/activate`, "POST"),
      );
      if (state.workspaceKey !== workspace) return;
      apply(result);
      ports.changed();
    },
    async save(change: unknown) {
      const modeId = state.modeEditor,
        workspace = state.workspaceKey;
      const result = readMode(
        record(await ports.request(`/modes/${modeId}`, "PATCH", change)).mode,
      );
      if (state.workspaceKey !== workspace)
        throw new DOMException("Interrupted", "AbortError");
      if (result.id !== modeId) throw Error("O servidor retornou outro modo.");
      state.modes = state.modes.map((mode) =>
        mode.id === modeId ? result : mode,
      );
      for (const item of document.querySelectorAll<HTMLElement>(
        "[data-edit-mode]",
      ))
        if (item.dataset.editMode === modeId)
          item.querySelector("span")!.textContent = result.name;
      for (const option of document.querySelectorAll<HTMLOptionElement>(
        ".mode-selector option",
      ))
        if (option.value === modeId) option.textContent = result.name;
      ports.changed();
      return result;
    },
    readSections,
    captureDraft() {
      const instructions =
        document.querySelector<HTMLTextAreaElement>("#instructions");
      if (!instructions || !document.querySelector("#note-sections")) return;
      const systemPrompt = document.querySelector<HTMLTextAreaElement>("#system-prompt");
      state.modeDrafts.set(state.modeEditor, {
        ...state.modeDrafts.get(state.modeEditor),
        ...(systemPrompt ? { systemPrompt: systemPrompt.value } : {}),
        instructions: instructions.value,
        notes: serializeNoteSections(readSections()),
      });
    },
    editSections(sections: NoteSection[]) {
      if (sections.length > 12) throw Error("Use até 12 seções por modelo.");
      state.modeDrafts.set(state.modeEditor, {
        ...state.modeDrafts.get(state.modeEditor),
        notes: serializeNoteSections(sections),
      });
      ports.render();
    },
  };
}
