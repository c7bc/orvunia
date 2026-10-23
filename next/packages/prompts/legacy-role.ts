import { defaultModeSystemPrompt, activityModeSystemPrompt } from "./defaults-en.ts";
import { defaultRoleInstructions, activityRoleInstructions } from "./mode-instructions.ts";

export function recognizedLegacyRoleInstructions(systemPrompt: string): string | null {
  for (const base of ["recruiter", "technical"] as const)
    if (systemPrompt === defaultModeSystemPrompt(base)) return defaultRoleInstructions(base);
  for (const activity of ["recruiting", "sales", "meeting", "lecture"] as const)
    if (systemPrompt === activityModeSystemPrompt(activity)) return activityRoleInstructions(activity);
  return null;
}
