import type { ExecutionDependencies } from "../operations/execution.ts";
import type { SessionRepository } from "../sessions/repository.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { ProviderSettings } from "../providers/settings.ts";
import type { HttpFetch } from "../providers/http.ts";

export type TranscriptionDependencies = ExecutionDependencies & {
  sessions: SessionRepository;
  workspace: WorkspaceService;
  providers: ProviderSettings;
  capabilities?: import("../capabilities/router.ts").CapabilityRouter;
  transport: HttpFetch;
  local: boolean;
  identifier(): string;
};
