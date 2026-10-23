import { expect, test } from "bun:test";
import { buildInstructions } from "../../packages/answers/instructions.ts";
import { answerSchema } from "../../packages/contracts/answers.ts";
import { customModePatchSchema } from "../../packages/contracts/modes.ts";
import { defaultModeSystemPrompt, modeTemplates } from "../../packages/workspaces/templates.ts";
import { actionInstructions, foundationInstructions, deliveryInstructions, calibrationExample } from "../../packages/answers/policy.ts";
import type { Preferences } from "../../packages/workspaces/domain.ts";
import { foundationSystemPrompt } from "../../packages/prompts/foundation-en.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
const preferences: Preferences = {
  output: "pt-BR", audio: "pt", code: "TypeScript", source: "microphone", instructions: "GLOBAL_STYLE",
  modeInstructions: { recruiter: "CAREER_STYLE", technical: "TECHNICAL_STYLE" },
  noteTemplates: { recruiter: "CAREER_NOTES", technical: "TECHNICAL_NOTES" },
};
function context(mode: "technical" | "recruiter", action = "custom") {
  return { profile: null, modeSystemPrompt: "", preferences: structuredClone(preferences),
    input: answerSchema.parse({ requestId: crypto.randomUUID(), mode, action }) };
}
const forbiddenFoundation = [foundationInstructions, foundationSystemPrompt, globalSystemPrompt("en"), deliveryInstructions("pt-BR", "assist"), calibrationExample];
test("edited mode instructions are the literal system text, without a hidden candidate foundation", () => {
  const value = context("technical");
  const authored = "Speak as the interviewer in the second person. Ask one follow-up question and do not draft the candidate's answer.";
  value.modeSystemPrompt = authored;
  value.preferences.modeInstructions.technical = "Follow the supplied coding standard.";
  const prompt = buildInstructions(value);
  expect(prompt).toContain(authored); expect(prompt).toContain("GLOBAL_STYLE");
  expect(prompt).toContain("# System prompt\n" + authored);
  expect(prompt).toContain("# Mode instructions\nFollow the supplied coding standard.");
  expect(prompt).not.toContain("CAREER_STYLE"); expect(prompt).not.toContain("TECHNICAL_NOTES");
  for (const hidden of forbiddenFoundation) expect(prompt).not.toContain(hidden);
  expect(prompt).not.toContain("They do not replace the base mode template");
  expect(prompt).not.toContain("# Orvunia answer policy");
});
test("authored mode headings and a different response voice are intentionally preserved, not enclosed as untrusted customization", () => {
  const value = context("technical"), authored = '# My response voice\nUse third-person narration.\n"A reviewer explains the evidence."';
  value.modeSystemPrompt = authored;
  expect(buildInstructions(value)).toContain(authored);
  expect(buildInstructions(value)).not.toContain(JSON.stringify(authored));
});
test("empty mode instructions remain empty for every action and never restore default behavioral rules", () => {
  for (const mode of ["technical", "recruiter"] as const)
    for (const action of ["assist", "custom", "star", "hint", "debug", "design", "recap", "followup", "email", "tests", "optimize", "explain"]) {
      const value = context(mode, action); value.preferences.instructions = ""; value.preferences.modeInstructions[mode] = "";
      const prompt = buildInstructions(value);
      for (const hidden of forbiddenFoundation) expect(prompt).not.toContain(hidden);
      expect(prompt).not.toContain(defaultModeSystemPrompt(mode));
      expect(prompt).not.toContain("# Response voice");
      expect(prompt).not.toContain("# Orvunia answer policy");
    }
});
test("notes remain action scoped and cannot leak between modes", () => {
  expect(buildInstructions(context("recruiter", "recap"))).toContain("CAREER_NOTES");
  expect(buildInstructions(context("recruiter", "recap"))).not.toContain("TECHNICAL_NOTES");
  expect(buildInstructions(context("recruiter", "custom"))).not.toContain("CAREER_NOTES");
  expect(buildInstructions(context("technical", "recap"))).toContain("TECHNICAL_NOTES");
});
test("personal facts remain outside instructions and output/code/action metadata remains explicit without mutating input", () => {
  for (const output of ["pt-BR", "en", "es"]) {
    const value = { ...context("technical", "hint"), profile: { name: "PRIVATE_FACT", role: "", job: "", company: "",
      tags: "", experience: "", description: "JOB_REQUIREMENT" } };
    value.preferences.output = output; value.input.codeLanguage = "Python";
    const before = structuredClone(value), prompt = buildInstructions(value);
    expect(prompt).not.toContain("PRIVATE_FACT"); expect(prompt).not.toContain("JOB_REQUIREMENT");
    expect(JSON.parse(prompt.split("\n\n")[1]!)).toEqual({ mode: "technical", outputLanguage: output, codeLanguage: "Python" });
    expect(prompt).toContain(actionInstructions.hint); expect(value).toEqual(before);
  }
});
test("default templates preserve IDs and sections and expose their complete editable instructions within the API contract", () => {
  expect(modeTemplates.map(template => template.id)).toEqual([
    "looking-for-work", "technical-interview", "recruiting", "sales", "team-meeting", "lecture",
  ]);
  for (const template of modeTemplates) {
    expect(template.sections).toHaveLength(3);
    const parsed = customModePatchSchema.parse({ systemPrompt: template.systemPrompt, instructions: template.instructions });
    expect(parsed.systemPrompt).toBe(template.systemPrompt); expect(parsed.instructions).toBe(template.instructions);
    const value = context(template.base); value.preferences.modeInstructions[template.base] = template.instructions;
    value.modeSystemPrompt = template.systemPrompt ?? "";
    expect(value.modeSystemPrompt.length).toBeGreaterThan(1000);
    expect(buildInstructions(value)).toContain(value.modeSystemPrompt);
    expect(buildInstructions(value)).toContain(template.instructions);
  }
});
