import { expect, test } from "bun:test";
import { builtinMode } from "../../packages/workspaces/defaults.ts";
import { defaultRoleInstructions, previousRoleInstructions } from "../../packages/prompts/mode-instructions.ts";
import { repositoryDeliveryInstructions } from "../../packages/prompts/repository.ts";
import { upgradeRepositoryPrompt } from "../../packages/workspaces/repository-prompt-upgrade.ts";
import { repositoryAgentInstructions } from "../../packages/repository-agent/definitions.ts";
import { previousRepositoryDeliveryInstructions } from "../../packages/prompts/repository-previous.ts";
import { priorRepositoryDeliveryInstructions } from "../../packages/prompts/repository-prior.ts";

test("the tested oral delivery is visible in technical mode instructions, with integrity metadata kept internal", () => {
  expect(defaultRoleInstructions("technical")).toContain(repositoryDeliveryInstructions);
  expect(defaultRoleInstructions("recruiter")).not.toContain(repositoryDeliveryInstructions);
  expect(repositoryDeliveryInstructions).toContain("primeira pessoa");
  expect(repositoryDeliveryInstructions).toContain("Mantenha separadas a fala, o código solicitado e as referências");
  expect(repositoryAgentInstructions).not.toContain("must cite relative path, line ranges, file hash");
});

test("only an exact stock prefix upgrades once; authored suffixes and metadata remain byte-identical", () => {
  const before = { ...builtinMode("technical", "unchanged"), instructions: previousRoleInstructions("technical") + "\n\n  Author suffix.\n" };
  const after = upgradeRepositoryPrompt(before);
  expect(after.instructions).toBe(defaultRoleInstructions("technical") + "\n\n  Author suffix.\n");
  expect(after.updated).toBe(before.updated);
  expect(after.systemPrompt).toBe(before.systemPrompt);
  expect(upgradeRepositoryPrompt(after)).toBe(after);
  for (const changed of ["", "Author instructions", previousRoleInstructions("technical") + " "])
    expect(upgradeRepositoryPrompt({ ...before, instructions: changed }).instructions).toBe(changed);
  const custom = { ...before, systemPrompt: "Author system prompt" };
  expect(upgradeRepositoryPrompt(custom)).toBe(custom);
});

test("the previous repository stock template upgrades without duplicating it or changing an authored suffix", () => {
  const suffix = "\n\nAuthor-specific directions.";
  const before = { ...builtinMode("technical", "unchanged"), instructions:
    previousRoleInstructions("technical") + "\n\n" + previousRepositoryDeliveryInstructions + suffix };
  const after = upgradeRepositoryPrompt(before);
  expect(after.instructions).toBe(defaultRoleInstructions("technical") + suffix);
  expect(upgradeRepositoryPrompt(after)).toBe(after);
});

test("the strict checklist stock template migrates once to conversational delivery without losing authored context", () => {
  const suffix = "\n\nMy professional context remains literal.";
  const before = { ...builtinMode("technical", "unchanged"), instructions:
    previousRoleInstructions("technical") + "\n\n" + priorRepositoryDeliveryInstructions + suffix };
  const after = upgradeRepositoryPrompt(before);
  expect(after.instructions).toBe(defaultRoleInstructions("technical") + suffix);
  expect(after.instructions).not.toContain("Checklist de entrega");
  expect(upgradeRepositoryPrompt(after)).toBe(after);
});
