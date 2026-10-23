import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type { ExecutionAccounting } from "../../packages/accounting/port.ts";
import type { ProviderSettings } from "../../packages/providers/settings.ts";
import type { HttpFetch } from "../../packages/providers/http.ts";
import type { AgentOwner, AgentStore, AgentUsageRecorder } from "../../packages/repository-agent/domain.ts";
import type { AgentDependencies } from "../../packages/repository-agent/ports.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";
import { repositoryAgentHistory } from "../../packages/repository-agent/history.ts";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";
import { legacyProviderReady } from "../../packages/providers/legacy-ready.ts";
import { RepositoryAgentError } from "../../packages/repository-agent/domain.ts";
import { repositoryTranscriptSources } from "../../packages/repository-agent/source-transcripts.ts";

export function repositoryComposition(ports: {
  sessions: SessionRepository; store: AgentStore; usage: AgentUsageRecorder;
  accounting: ExecutionAccounting; providers: ProviderSettings; transport: HttpFetch;
  admission?: AgentDependencies["admission"];
  presentation?(owner: AgentOwner): Promise<string>;
}) {
  const service = createRepositoryAgent({ ...ports, identifier: () => crypto.randomUUID(), clock: Date.now,
    complete: repositoryAgentHistory(ports.sessions),
    validateSources: repositoryTranscriptSources(ports.sessions),
    async authorized(owner) {
      const session = await ports.sessions.find(owner.workspaceId, owner.sessionId);
      return session !== null && session.state !== "ended";
    },
    async historyGeneration(owner) {
      const session = await ports.sessions.find(owner.workspaceId, owner.sessionId);
      if (!session) throw new RepositoryAgentError("repository_agent_not_found", 404);
      return session.historyGeneration;
    },
    async model(owner) {
      if (!legacyProviderReady(ports.providers, "response"))
        throw new RepositoryAgentError("repository_tool_provider_unsupported", 422);
      return openaiRepositoryModel(ports.providers.effective("response"), ports.transport,
        await ports.presentation?.(owner) ?? "");
    },
  });
  return { service, sessions: ports.sessions };
}
