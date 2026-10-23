import type { CustomMode, ModeBase, Workspace } from "./domain.ts";
import { globalSystemPrompt } from "../prompts/global.ts";
import { defaultRoleInstructions } from "../prompts/mode-instructions.ts";

export function emptyWorkspace(id: string, now: string): Workspace {
  return {
    id,
    revision: 0,
    systemPromptVersion: 3,
    profile: null,
    preferences: {
      output: "pt-BR",
      audio: "pt",
      code: "TypeScript",
      source: "microphone",
      instructions: "",
      modeInstructions: { recruiter: "", technical: "" },
      noteTemplates: { recruiter: "", technical: "" },
    },
    library: { documents: [], prompts: [] },
    modes: (["recruiter", "technical"] as const).map((base) =>
      builtinMode(base, now),
    ),
    activeId: "recruiter",
  };
}
export function builtinMode(base: ModeBase, now: string): CustomMode {
  return {
    id: base,
    name: base === "technical" ? "Entrevista técnica" : "Geral",
    base,
    builtin: true,
    systemPrompt: globalSystemPrompt("en"),
    instructions: defaultRoleInstructions(base),
    sections: [],
    documents: [],
    created: now,
    updated: now,
  };
}
