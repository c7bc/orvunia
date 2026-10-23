import type { CommandPorts } from "./ports.js";
export function commandDraft(ports: CommandPorts, id: string) {
  const draft = ports.modeDrafts.get(id);
  if (!draft || typeof draft.notes !== "string")
    throw Error("Reabra o editor do modo antes de continuar.");
  return { ...draft, notes: draft.notes };
}
export function commandPreset(ports: CommandPorts, id: string) {
  const preset = ports.notePresets[id];
  if (!preset) throw Error("Escolha um modelo de notas disponível.");
  return preset;
}
export function commandEditedMode(ports: CommandPorts) {
  const mode = ports.editedMode();
  if (!mode) throw Error("Reabra o modo antes de continuar.");
  return mode;
}
