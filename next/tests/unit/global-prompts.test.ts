import { expect, test } from "bun:test";
import { globalSystemPrompt, recognizedGlobalSystemPromptLocale } from "../../packages/prompts/global.ts";
import { defaultRoleInstructions, activityRoleInstructions } from "../../packages/prompts/mode-instructions.ts";
import { defaultModeSystemPrompt, activityModeSystemPrompt } from "../../packages/prompts/defaults-en.ts";
import { defaultModeInstructions } from "../../packages/prompts/defaults.ts";
import { upgradeModePrompts } from "../../packages/prompts/upgrade.ts";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import { modeTemplates } from "../../packages/workspaces/templates.ts";

test("every builtin and activity shares one generic global system prompt with separate Portuguese role instructions", () => {
  const workspace = emptyWorkspace("synthetic", "2026-10-20T00:00:00Z");
  expect(workspace.systemPromptVersion).toBe(3);
  for (const mode of [...workspace.modes, ...modeTemplates]) expect(mode.systemPrompt).toBe(globalSystemPrompt("en"));
  for (const mode of workspace.modes) expect(mode.instructions).toBe(defaultRoleInstructions(mode.base));
  for (const id of ["recruiting", "sales", "team-meeting", "lecture"]) {
    const mode = modeTemplates.find(value => value.id === id);
    expect(mode?.instructions).toMatch(/^Papel:/);
    expect(mode?.instructions).not.toContain("Voz nas entrevistas");
  }
});

test("localized global templates are role-neutral and exact recognition never treats a custom edit as stock", () => {
  const texts = new Set<string>();
  for (const locale of ["en", "pt-BR", "es"] as const) {
    const text = globalSystemPrompt(locale);
    texts.add(text);
    expect(recognizedGlobalSystemPromptLocale(text)).toBe(locale);
    expect(recognizedGlobalSystemPromptLocale(text + " ")).toBeNull();
    expect(recognizedGlobalSystemPromptLocale(text.slice(1))).toBeNull();
    expect(text).not.toMatch(/candidate|recruiter|sales|candidato|entrevistador|vendas|\b120\b|\b250\b/i);
  }
  expect(texts.size).toBe(3);
  expect(recognizedGlobalSystemPromptLocale("")).toBeNull();
  expect(recognizedGlobalSystemPromptLocale(defaultModeSystemPrompt("technical"))).toBeNull();
  expect(recognizedGlobalSystemPromptLocale(defaultModeInstructions("technical"))).toBeNull();
});

test("all exact version-two role templates move into instructions once without changing author data", () => {
  const configurations = [
    ...(["recruiter", "technical"] as const).map(base => ({ base,
      systemPrompt: defaultModeSystemPrompt(base), role: defaultRoleInstructions(base) })),
    ...(["recruiting", "sales", "meeting", "lecture"] as const).map(activity => ({ base: "recruiter" as const,
      systemPrompt: activityModeSystemPrompt(activity), role: activityRoleInstructions(activity) })),
  ];
  for (const configuration of configurations) {
    const original = { id: "Preserved identity", base: configuration.base, systemPrompt: configuration.systemPrompt,
      instructions: "  Exact authored text.\n", updated: "Preserved timestamp" };
    const migrated = upgradeModePrompts(original, 2);
    expect(migrated.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(migrated.instructions).toBe(configuration.role + "\n\n" + original.instructions);
    expect(migrated.id).toBe(original.id);
    expect(migrated.updated).toBe(original.updated);
    expect(upgradeModePrompts(migrated, 3)).toEqual(migrated);
  }
});

test("custom, blank and superficially edited system prompts remain byte-exact", () => {
  for (const systemPrompt of ["", "Author system prompt", defaultModeSystemPrompt("technical") + " ", globalSystemPrompt("pt-BR")]) {
    const original = { base: "technical" as const, systemPrompt, instructions: "Author instructions" };
    expect(upgradeModePrompts(original, 2)).toEqual(original);
  }
});

test("already-present role instructions are not duplicated during stock system migration", () => {
  const original = { base: "technical" as const, systemPrompt: defaultModeSystemPrompt("technical"),
    instructions: defaultRoleInstructions("technical") + "\n\nAuthor suffix" };
  expect(upgradeModePrompts(original, 2).instructions).toBe(original.instructions);
});
