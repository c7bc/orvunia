import { foundationSystemPrompt } from "./foundation-en.ts";
import { experienceSystemPromptExamples } from "./examples-en.ts";
import { activitySystemPrompts, baseModeSystemPrompts, interviewVoiceSystemPrompt } from "./roles-en.ts";

export function defaultModeSystemPrompt(base: keyof typeof baseModeSystemPrompts): string {
  return [
    baseModeSystemPrompts[base],
    interviewVoiceSystemPrompt,
    foundationSystemPrompt,
    experienceSystemPromptExamples,
  ].join("\n\n");
}

export function activityModeSystemPrompt(activity: keyof typeof activitySystemPrompts): string {
  return [activitySystemPrompts[activity], foundationSystemPrompt].join("\n\n");
}
