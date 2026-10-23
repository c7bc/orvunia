import { foundationInstructions } from "./foundation.ts";
import { calibrationExample } from "./examples.ts";
import { activityInstructions, baseModeInstructions, interviewVoiceInstructions } from "./roles.ts";

export function defaultModeInstructions(base: keyof typeof baseModeInstructions): string {
  return [
    baseModeInstructions[base],
    interviewVoiceInstructions,
    foundationInstructions,
    calibrationExample,
  ].join("\n\n");
}

export function activityModeInstructions(activity: keyof typeof activityInstructions): string {
  return [activityInstructions[activity], foundationInstructions].join("\n\n");
}
