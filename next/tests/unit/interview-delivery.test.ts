import { expect, test } from "bun:test";
import { buildInstructions } from "../../packages/answers/instructions.ts";
import { foundationSystemPrompt } from "../../packages/prompts/foundation-en.ts";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import { modeTemplates } from "../../packages/workspaces/templates.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
import { defaultRoleInstructions } from "../../packages/prompts/mode-instructions.ts";
import { interviewVoiceInstructions } from "../../packages/prompts/roles.ts";
import { interviewVoiceSystemPrompt } from "../../packages/prompts/roles-en.ts";
import { answerSchema } from "../../packages/contracts/answers.ts";
import { repositoryAgentInstructions } from "../../packages/repository-agent/definitions.ts";
test("candidate delivery and greeting guidance live inside the editable defaults", () => {
  for (const base of ["recruiter", "technical"] as const) {
    const instructions = defaultRoleInstructions(base);
    expect(instructions).toContain(interviewVoiceInstructions);
    expect(globalSystemPrompt("en")).not.toContain("candidate");
    expect(globalSystemPrompt("en")).not.toContain(interviewVoiceSystemPrompt);
  }
});
test("every direct action uses the authored mode voice without appending candidate behavior", () => {
  const preferences = emptyWorkspace("synthetic", "2026-01-01T00:00:00Z").preferences;
  preferences.instructions = "PERSONAL_STYLE";
  const authored = "Respond as a technical interviewer. Address the reader in the second person and ask a focused question.";
  preferences.modeInstructions.technical = "MODE_DETAILS";
  for (const action of ["assist", "custom", "star", "hint", "debug", "design", "recap", "followup", "email", "tests", "optimize", "explain"]) {
    const input = answerSchema.parse({ requestId: crypto.randomUUID(), mode: "technical", action });
    const prompt = buildInstructions({ input, preferences, profile: null, modeSystemPrompt: authored });
    expect(prompt).toContain(authored); expect(prompt).toContain("PERSONAL_STYLE");
    expect(prompt).toContain("MODE_DETAILS");
    expect(prompt).not.toContain("# Response voice"); expect(prompt).not.toContain(foundationSystemPrompt);
    expect(prompt).not.toContain("candidate's response"); expect(prompt).not.toContain("primeira pessoa do candidato");
  }
});
test("activity templates keep their own visible roles instead of inheriting an interview candidate role", () => {
  const expected = { recruiting: "entrevistador", sales: "vendas", "team-meeting": "reunião", lecture: "estudo" };
  for (const [id, role] of Object.entries(expected)) {
    const template = modeTemplates.find(template => template.id === id)!;
    const instructions = template.instructions;
    expect(instructions.toLowerCase()).toContain(role);
    expect(instructions).not.toContain(interviewVoiceInstructions);
    expect(template.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(template.systemPrompt).not.toContain("candidate");
  }
});
test("repository instructions retain capabilities and evidence without imposing a conversation role", () => {
  expect(repositoryAgentInstructions).toContain("repository_list"); expect(repositoryAgentInstructions).toContain("repository_read");
  expect(repositoryAgentInstructions).toContain("snapshot"); expect(repositoryAgentInstructions).toContain("internal metadata");
  expect(repositoryAgentInstructions).toContain("not applied or tested");
  expect(repositoryAgentInstructions).not.toContain("candidate"); expect(repositoryAgentInstructions).not.toContain("first person");
  expect(repositoryAgentInstructions).not.toContain("review assistant");
});
