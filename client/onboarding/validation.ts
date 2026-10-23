import type { OnboardingState } from "./contracts.js";
export function onboardingResponse(value: unknown): OnboardingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Resposta de configuração inválida.");
  const record: Record<string, unknown> = { industry: "", discovery: "", ...value };
  if (record.version !== 1 || !["completed", "skipped", "tutorialComplete"].every((key) => typeof record[key] === "boolean") ||
    !["persona", "industry", "discovery", "goal", "experience", "output", "code"].every((key) => typeof record[key] === "string") ||
    !["recruiter", "technical"].includes(String(record.mode))) throw Error("Resposta de configuração inválida.");
  return record as OnboardingState;
}
