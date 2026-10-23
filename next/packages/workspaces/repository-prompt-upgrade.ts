import type { CustomMode } from "./domain.ts";
import { recognizedGlobalSystemPromptLocale } from "../prompts/global.ts";
import { defaultRoleInstructions, previousRoleInstructions } from "../prompts/mode-instructions.ts";
import { previousRepositoryDeliveryInstructions } from "../prompts/repository-previous.ts";
import { priorRepositoryDeliveryInstructions } from "../prompts/repository-prior.ts";

export function upgradeRepositoryPrompt(mode: CustomMode): CustomMode {
  if (mode.base !== "technical" || !recognizedGlobalSystemPromptLocale(mode.systemPrompt ?? "")) return mode;
  const original = previousRoleInstructions("technical"), next = defaultRoleInstructions("technical");
  if (mode.instructions === next || mode.instructions.startsWith(next + "\n\n")) return mode;
  const previous = [original + "\n\n" + priorRepositoryDeliveryInstructions,
    original + "\n\n" + previousRepositoryDeliveryInstructions, original].find(prefix =>
    mode.instructions === prefix || mode.instructions.startsWith(prefix + "\n\n"));
  if (!previous) return mode;
  return { ...mode, instructions: next + mode.instructions.slice(previous.length) };
}
