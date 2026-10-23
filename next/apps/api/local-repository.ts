import type { SqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { ExecutionAccounting } from "../../packages/accounting/port.ts";
import type { ProviderSettings } from "../../packages/providers/settings.ts";
import type { HttpFetch } from "../../packages/providers/http.ts";
import { sqliteRepositoryAgent } from "../../packages/repository-agent/sqlite.ts";
import { sqliteRepositoryAgentUsage } from "../../packages/repository-agent/sqlite-usage.ts";
import { repositoryComposition } from "./repository-composition.ts";
import { repositoryPrompt } from "./repository-prompt.ts";
import type { WorkspaceService } from "../../packages/workspaces/service.ts";

export function localRepository(connection: SqliteConnection, sessions: SessionRepository,
  accounting: ExecutionAccounting, providers: ProviderSettings, transport: HttpFetch, workspaces: WorkspaceService) {
  return repositoryComposition({ sessions, accounting, providers, transport,
    presentation: repositoryPrompt(workspaces, sessions),
    store: sqliteRepositoryAgent(connection.client), usage: sqliteRepositoryAgentUsage(connection.client) });
}
