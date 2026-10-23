import { baseModeInstructions, interviewVoiceInstructions, activityInstructions } from "./roles.ts";
import { calibrationExample } from "./examples.ts";
import { repositoryDeliveryInstructions } from "./repository.ts";

export function defaultRoleInstructions(base: keyof typeof baseModeInstructions): string {
  return [previousRoleInstructions(base), base === "technical" ? repositoryDeliveryInstructions : ""].filter(Boolean).join("\n\n");
}
export function previousRoleInstructions(base: keyof typeof baseModeInstructions): string {
  return [baseModeInstructions[base], interviewVoiceInstructions, calibrationExample].join("\n\n");
}
export function activityRoleInstructions(activity: keyof typeof activityInstructions): string {
  return activityInstructions[activity];
}
