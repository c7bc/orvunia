import type { SessionRepository } from "../sessions/repository.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { AssetRepository } from "../assets/repository.ts";
import type { ObjectStore } from "../assets/domain.ts";
import type { OperationRepository } from "../operations/repository.ts";
import type { ProviderSettings } from "../providers/settings.ts";
import type { HttpFetch } from "../providers/http.ts";

export type AnswerDependencies =
  import("../operations/execution.ts").ExecutionDependencies & {
    sessions: SessionRepository;
    workspace: WorkspaceService;
    assets: AssetRepository;
    objects: ObjectStore;
    operations: OperationRepository;
    providers: ProviderSettings;
    capabilities?: import("../capabilities/router.ts").CapabilityRouter;
    selectResponseModel?: (scope: {
      workspaceId: string; sessionId: string; modeId: string;
      provider: import("../operations/domain.ts").ProviderSnapshot;
    }) => import("../operations/domain.ts").ProviderSnapshot;
    operationStages?: import("../operations/stages.ts").OperationStageRepository;
    transport: HttpFetch;
    identifier(): string;
  };
