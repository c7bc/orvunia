import type { Workspace } from "./domain.ts";

export interface WorkspaceRepository {
  find(id: string): Promise<Workspace | null>;
  insert(workspace: Workspace): Promise<boolean>;
  replace(workspace: Workspace, expectedRevision: number): Promise<boolean>;
}
