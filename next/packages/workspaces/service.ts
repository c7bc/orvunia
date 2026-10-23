import type { Library, Preferences, Profile, Workspace } from "./domain.ts";
import { WorkspaceError } from "./domain.ts";
import { emptyWorkspace } from "./defaults.ts";
import type { WorkspaceRepository } from "./repository.ts";
import { materializeWorkspacePrompts } from "./prompt-migration.ts";

export function workspaces(repository: WorkspaceRepository, clock: () => Date) {
  async function find(id: string): Promise<Workspace> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await repository.find(id);
      const now = clock().toISOString();
      if (!current) {
        const initial = emptyWorkspace(id, now);
        if (await repository.insert(initial)) return initial;
        continue;
      }
      const migrated = materializeWorkspacePrompts(current, now);
      if (!migrated) return current;
      migrated.revision = current.revision + 1;
      if (await repository.replace(migrated, current.revision)) return migrated;
    }
    throw new WorkspaceError("workspace_conflict");
  }
  async function update<Result>(
    id: string,
    change: (workspace: Workspace) => Result,
  ): Promise<Result> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await find(id);
      const next = structuredClone(current);
      const result = change(next);
      next.revision = current.revision + 1;
      if (await repository.replace(next, current.revision)) return result;
    }
    throw new WorkspaceError("workspace_conflict");
  }
  return {
    find,
    update,
    saveProfile: (id: string, profile: Profile) =>
      update(id, (workspace) => (workspace.profile = profile)),
    savePreferences: (id: string, preferences: Preferences) =>
      update(id, (workspace) => (workspace.preferences = preferences)),
    saveLibrary: (id: string, library: Library) =>
      update(id, (workspace) => (workspace.library = library)),
  };
}
export type WorkspaceService = ReturnType<typeof workspaces>;
