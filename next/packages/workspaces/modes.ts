import type { CustomMode, ModeBase } from "./domain.ts";
import { WorkspaceError } from "./domain.ts";
import type { WorkspaceService } from "./service.ts";
import { modeTemplates } from "./templates.ts";
import { globalSystemPrompt } from "../prompts/global.ts";

type ModeInput = Pick<
  CustomMode,
  "name" | "base" | "systemPrompt" | "instructions" | "sections" | "documents"
>;
export type CreateMode = {
  name?: string;
  base?: ModeBase;
  templateId?: string;
};

export function modes(
  workspaces: WorkspaceService,
  identifier: () => string,
  clock: () => Date,
) {
  async function list(workspaceId: string) {
    const workspace = await workspaces.find(workspaceId);
    return {
      modes: workspace.modes,
      activeId: workspace.activeId,
      templates: modeTemplates,
    };
  }
  async function create(workspaceId: string, input: CreateMode) {
    const template = modeTemplates.find((item) => item.id === input.templateId);
    if (input.templateId && !template)
      throw new WorkspaceError("mode_not_found");
    const now = clock().toISOString();
    const base = input.base ?? template?.base ?? "recruiter";
    const mode: CustomMode = {
      id: identifier(),
      name: input.name ?? template?.name ?? "Modo sem título",
      base,
      systemPrompt: template?.systemPrompt ?? globalSystemPrompt("en"),
      instructions: template?.instructions ?? "",
      sections: template ? structuredClone(template.sections) : [],
      documents: [],
      builtin: false,
      created: now,
      updated: now,
    };
    await workspaces.update(workspaceId, (workspace) => {
      if (workspace.modes.length >= 100) throw new WorkspaceError("mode_limit");
      workspace.modes.push(mode);
      if (!template) workspace.activeId = mode.id;
    });
    return { ...(await list(workspaceId)), mode };
  }
  async function edit(
    workspaceId: string,
    id: string,
    input: Partial<ModeInput>,
  ) {
    return workspaces.update(workspaceId, (workspace) => {
      const current = workspace.modes.find((mode) => mode.id === id);
      if (!current) throw new WorkspaceError("mode_not_found");
      if (current.builtin && input.base && input.base !== current.base)
        throw new WorkspaceError("builtin_mode");
      Object.assign(current, input, { updated: clock().toISOString() });
      return { mode: current };
    });
  }
  async function remove(workspaceId: string, id: string) {
    await workspaces.update(workspaceId, (workspace) => {
      const current = workspace.modes.find((mode) => mode.id === id);
      if (!current) throw new WorkspaceError("mode_not_found");
      if (current.builtin) throw new WorkspaceError("builtin_mode");
      workspace.modes = workspace.modes.filter((mode) => mode.id !== id);
      if (workspace.activeId === id) workspace.activeId = "recruiter";
    });
    return list(workspaceId);
  }
  async function activate(workspaceId: string, id: string) {
    await workspaces.update(workspaceId, (workspace) => {
      if (!workspace.modes.some((mode) => mode.id === id))
        throw new WorkspaceError("mode_not_found");
      workspace.activeId = id;
    });
    return list(workspaceId);
  }
  return { list, create, edit, remove, activate };
}
export type ModeService = ReturnType<typeof modes>;
