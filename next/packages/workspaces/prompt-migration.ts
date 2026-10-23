import type { CustomMode, Workspace } from "./domain.ts";
import { WorkspaceError } from "./domain.ts";
import { builtinMode } from "./defaults.ts";
import { upgradeModePrompts } from "../prompts/upgrade.ts";
import { upgradeRepositoryPrompt } from "./repository-prompt-upgrade.ts";

const bases = ["recruiter", "technical"] as const;

function combine(...parts: string[]) {
  return [...new Set(parts.filter(part => part.length > 0))].join("\n\n");
}

export function materializeWorkspacePrompts(current: Workspace, now: string): Workspace | null {
  const legacy = current.systemPromptVersion !== 3;
  const missing = bases.filter(base => !current.modes.some(mode => mode.id === base));
  for (const base of bases) {
    const present = current.modes.find(mode => mode.id === base);
    if (present && (!present.builtin || present.base !== base)) throw new WorkspaceError("workspace_conflict");
  }
  const delivery = current.modes.some(mode => upgradeRepositoryPrompt(mode) !== mode);
  if (!legacy && missing.length === 0 && !delivery) return null;
  const next = structuredClone(current);
  if (legacy) {
    next.modes = next.modes.map((mode): CustomMode => {
      const separated = upgradeModePrompts(mode, current.systemPromptVersion);
      const inherited = [next.preferences.modeInstructions[mode.base], next.preferences.instructions]
        .filter(text => text !== mode.instructions);
      return { ...separated, instructions: combine(separated.instructions, ...inherited) };
    });
  }
  next.modes = next.modes.map(upgradeRepositoryPrompt);
  for (const base of missing) {
    const mode = builtinMode(base, now);
    if (legacy) mode.instructions = combine(mode.instructions,
      next.preferences.modeInstructions[base], next.preferences.instructions);
    next.modes.push(mode);
  }
  if (legacy) {
    next.preferences.instructions = "";
    next.preferences.modeInstructions = { recruiter: "", technical: "" };
    next.systemPromptVersion = 3;
  }
  return next;
}
