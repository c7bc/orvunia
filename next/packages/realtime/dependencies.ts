import type { TicketStore, UpstreamFactory, Permit } from "./domain.ts";
import type { Identity } from "../identity/principal.ts";
import type { SessionRepository } from "../sessions/repository.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { ProviderSettings } from "../providers/settings.ts";
import type { ExecutionAccounting } from "../accounting/port.ts";
export type RealtimeDependencies = {
  tickets: TicketStore;
  sessions: SessionRepository;
  workspace: WorkspaceService;
  providers: ProviderSettings;
  usage: ExecutionAccounting;
  identity: Identity;
  origin: string;
  local: boolean;
  upstream: UpstreamFactory;
  admit(workspaceId: string): Promise<Permit>;
  clock(): number;
  identifier(): string;
  log(event: {
    event: string;
    channelId: string;
    code?: string;
    errorType?: string;
  }): void;
  heartbeatMs?: number;
};
