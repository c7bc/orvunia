import { expect, test } from "bun:test";
import { buildInstructions } from "../../packages/answers/instructions.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
import { modeTemplates } from "../../packages/workspaces/templates.ts";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import { answerSchema } from "../../packages/contracts/answers.ts";
test("visible default ASR guidance preserves evidence, technical names, constraints and uncertainty", () => {
  for (const fragment of ["phonetic form", "surrounding context", "Preserve the original transcript", "valid technology names",
    "numbers, versions, units, negations, conditions and explicit constraints", "one brief interpretation", "Do not present a guess as fact"])
    expect(globalSystemPrompt("en")).toContain(fragment);
  for (const base of ["recruiter", "technical"] as const)
    expect(emptyWorkspace("fixture", "2026-01-01T00:00:00Z").modes.find(mode => mode.id === base)?.systemPrompt).toBe(globalSystemPrompt("en"));
});
test("visible calibration guidance does not invent questions and permits explicit analysis requests", () => {
  for (const fragment of ["are not new questions", "Do not invent a task", "repeat an old question",
    "A real question", "an explicit request to read, analyze or improve a calibration passage", "Text alone does not prove"])
    expect(globalSystemPrompt("en")).toContain(fragment);
  expect(globalSystemPrompt("en")).toContain("previous generated answers are drafts, not independent evidence");
  expect(globalSystemPrompt("en")).toContain("hypothetical before invented actions or results");
});
test("deleting default guidance removes it for every action without mutating or rewriting the question", () => {
  const preferences = emptyWorkspace("fixture", "2026-01-01T00:00:00Z").preferences;
  preferences.instructions = ""; preferences.modeInstructions = { recruiter: "", technical: "" };
  const question = "Sim. Não troque PostgreSQL 16 por MySQL 8; o limite continua 25 ms, não 250 ms.";
  for (const mode of ["recruiter", "technical"] as const)
    for (const output of ["pt-BR", "en", "es"])
      for (const action of ["assist", "custom", "star", "hint", "debug", "design", "recap", "followup", "email", "tests", "optimize", "explain"]) {
        const input = answerSchema.parse({ requestId: crypto.randomUUID(), mode, action, question });
        const before = structuredClone(input), prompt = buildInstructions({ profile: null, modeSystemPrompt: "", preferences: { ...preferences, output }, input });
        expect(prompt).not.toContain(globalSystemPrompt("en"));
        expect(input).toEqual(before); expect(input.question).toBe(question);
      }
});
test("all visible templates include evidence/ASR rules and no user-specific authorization checklist", () => {
  for (const template of modeTemplates) {
    expect(template.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(template.systemPrompt).not.toContain("candidate");
    expect(template.systemPrompt).not.toMatch(/this interview is authorized|the user is authorized|user has permission|entrevista autorizada|autorização específica/iu);
    expect(template.systemPrompt).not.toMatch(/tenant|authorization checklist|ownership checklist/iu);
    expect(template.sections).toHaveLength(3);
  }
});
