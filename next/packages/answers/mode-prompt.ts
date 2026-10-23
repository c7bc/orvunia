import type { Workspace, ModeBase } from "../workspaces/domain.ts";
import type { ModeSnapshot } from "../sessions/domain.ts";

export function selectedModeConfiguration(
  workspace: Pick<Workspace, "modes" | "preferences">,
  snapshot: ModeSnapshot | null,
  base: ModeBase,
) {
  const selected = snapshot?.base === base ? snapshot : null;
  const current = workspace.modes.find(mode => mode.id === (selected?.id ?? base) && mode.base === base);
  if (current) return { systemPrompt: current.systemPrompt ?? "", instructions: current.instructions };
  if (selected) return { systemPrompt: selected.systemPrompt ?? "", instructions: selected.instructions };
  return { systemPrompt: "", instructions: workspace.preferences.modeInstructions[base] ?? "" };
}
export function selectedModePrompt(workspace: Pick<Workspace, "modes" | "preferences">,
  snapshot: ModeSnapshot | null, base: ModeBase) {
  return selectedModeConfiguration(workspace, snapshot, base).instructions;
}
