import type { AnswerInput } from "../contracts/answers.ts";
import type { Profile, Preferences } from "../workspaces/domain.ts";
import { actionInstructions } from "./policy.ts";
export type PromptContext = {
  input: AnswerInput;
  profile: Profile | null;
  preferences: Preferences;
  modeSystemPrompt?: string;
};
export function buildInstructions(c: PromptContext) {
  return [
    "# Configuração solicitada",
    JSON.stringify({
      mode: c.input.mode,
      outputLanguage: c.preferences.output,
      codeLanguage: c.input.codeLanguage ?? c.preferences.code,
    }),
    `# System prompt\n${c.modeSystemPrompt ?? ""}`,
    `# Mode instructions\n${c.preferences.modeInstructions?.[c.input.mode] ?? ""}`,
    c.preferences.instructions ? `# Preferências do usuário\n${c.preferences.instructions}` : "",
    `# Ação solicitada\n${actionInstructions[c.input.action]}`,
    c.input.action === "recap" && c.preferences.noteTemplates?.[c.input.mode]
      ? `# Modelo de notas\n${c.preferences.noteTemplates[c.input.mode]}` : "",
  ].filter(Boolean).join("\n\n");
}
