import type { Onboarding } from "./domain.ts";
import type { WorkspaceService } from "./service.ts";

export function defaultOnboarding(): Onboarding {
  return {
    version: 1,
    completed: false,
    skipped: false,
    persona: "",
    goal: "",
    industry: "",
    discovery: "",
    experience: "",
    mode: "recruiter",
    output: "pt-BR",
    code: "TypeScript",
    tutorialComplete: false,
  };
}
export function onboarding(workspaces: WorkspaceService) {
  return {
    async find(workspaceId: string) {
      return (
        (await workspaces.find(workspaceId)).onboarding ?? defaultOnboarding()
      );
    },
    save(workspaceId: string, state: Onboarding) {
      return workspaces.update(
        workspaceId,
        (workspace) => (workspace.onboarding = structuredClone(state)),
      );
    },
  };
}
