export type ModeBase = "recruiter" | "technical";
export type NoteSection = { title: string; instructions: string };
export type Document = { id: string; name: string; text: string; date: string };
export type CustomMode = {
  id: string;
  name: string;
  base: ModeBase;
  instructions: string;
  systemPrompt?: string;
  sections: NoteSection[];
  documents: Document[];
  builtin: boolean;
  created: string;
  updated: string;
};
export type Profile = {
  name: string;
  role: string;
  job: string;
  company: string;
  tags: string;
  experience: string;
  description: string;
};
export type Preferences = {
  output: string;
  audio: string;
  code: string;
  source: "microphone" | "display";
  instructions: string;
  modeInstructions: Record<ModeBase, string>;
  noteTemplates: Record<ModeBase, string>;
};
export type Library = {
  documents: (Document & { mode?: ModeBase })[];
  prompts: {
    id: string;
    title: string;
    instructions: string;
    mode: ModeBase;
  }[];
};
export type Onboarding = {
  version: 1;
  completed: boolean;
  skipped: boolean;
  persona: "job" | "student" | "professional" | "curious" | "";
  goal: string;
  industry: string;
  discovery: string;
  experience: string;
  mode: ModeBase;
  output: string;
  code: string;
  tutorialComplete: boolean;
};
export type Workspace = {
  onboarding?: Onboarding;
  systemPromptVersion?: 1 | 2 | 3;
  id: string;
  revision: number;
  profile: Profile | null;
  preferences: Preferences;
  library: Library;
  modes: CustomMode[];
  activeId: string;
};
export type WorkspaceErrorCode =
  | "mode_not_found"
  | "mode_limit"
  | "builtin_mode"
  | "workspace_conflict"
  | "operation_busy";
export class WorkspaceError extends Error {
  constructor(readonly code: WorkspaceErrorCode) {
    super(code);
  }
}
