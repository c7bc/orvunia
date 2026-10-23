import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { SqliteAccounting } from "../../packages/storage/sqlite/accounting.ts";
import { localAccounting } from "../../packages/accounting/service.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";
import { sqliteRepositoryAgent, repositoryAgentSqliteSchema } from "../../packages/repository-agent/sqlite.ts";
import { sqliteRepositoryAgentUsage, repositoryAgentUsageSqliteSchema } from "../../packages/repository-agent/sqlite-usage.ts";
import { repositoryAgentHistory } from "../../packages/repository-agent/history.ts";
import { repositoryTranscriptSources } from "../../packages/repository-agent/source-transcripts.ts";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";
import { createRepositoryContext } from "../../packages/repository-context/service.ts";
import { repositoryFilesystem } from "../../packages/repository-context/filesystem.ts";
import type { AgentModel, AgentOwner } from "../../packages/repository-agent/domain.ts";
import { repositoryProviderStream } from "./repository-provider.ts";

export async function repositoryAgentFixture(filename = ":memory:", scope = ["src", "README.md"]) {
  const connection = sqliteConnection(filename);
  await migrateSqlite(connection);
  connection.client.exec(repositoryAgentSqliteSchema + repositoryAgentUsageSqliteSchema);
  const sessions = new SqliteSessions(connection);
  const owner: AgentOwner = { workspaceId: crypto.randomUUID(), actorId: crypto.randomUUID(), sessionId: crypto.randomUUID() };
  let instant = Date.now(), authorized = true;
  await workspaces(new SqliteWorkspaces(connection), () => new Date(instant)).find(owner.workspaceId);
  await sessions.create({ id: owner.sessionId, workspaceId: owner.workspaceId, title: "Repository fixture",
    mode: "technical", state: "active", createdAt: new Date(instant).toISOString(), elapsed: 0,
    question: "", modeSnapshot: null, historyGeneration: 0, revision: 0 });
  const accounting = localAccounting(new SqliteAccounting(connection), () => crypto.randomUUID(), () => instant);
  const store = sqliteRepositoryAgent(connection.client);
  const usageRecorder = sqliteRepositoryAgentUsage(connection.client);
  const context = createRepositoryContext({ clock: () => new Date(instant), identifier: () => crypto.randomUUID(),
    hash: (bytes) => createHash("sha256").update(bytes).digest("hex"), open: repositoryFilesystem });
  const nativeOwner = { ...owner, windowId: "isolated-fixture" };
  const preview = await context.select(nativeOwner, resolve(import.meta.dir, "../fixtures/repository"),
    scope, new AbortController().signal);
  context.approve(nativeOwner, preview, true);
  const requests: Record<string, unknown>[] = [];
  const responseQueue: Record<string, unknown>[] = [];
  let answerGate: Promise<void> | undefined;
  const provider = openaiRepositoryModel({ provider: "openai", model: "controlled-fixture", baseUrl: "https://fixture.invalid/v1",
    vision: false, maxTokens: 2048, apiKey: "synthetic-not-real" }, async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
    const response = responseQueue.shift();
    if (!response) throw Error("Controlled response queue exhausted");
    const gate = (response.output as { type: string }[]).some(item => item.type === "message") ? answerGate : undefined;
    if (gate) answerGate = undefined;
    return repositoryProviderStream(response, { afterFirstText: () => gate ?? Promise.resolve() });
  });
  let model: AgentModel = provider;
  const dependencies = { store, accounting, usage: usageRecorder, identifier: () => crypto.randomUUID(),
    validateSources: repositoryTranscriptSources(sessions),
    clock: () => instant, authorized: async () => authorized, historyGeneration: async () =>
      (await sessions.find(owner.workspaceId, owner.sessionId))!.historyGeneration,
    model: async () => model, complete: repositoryAgentHistory(sessions) };
  const service = createRepositoryAgent(dependencies);
  function response(output: unknown[], status = "completed") {
    responseQueue.push({ id: crypto.randomUUID(), object: "response", status, model: "controlled-fixture",
      output, usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120,
        input_tokens_details: { cached_tokens: 5 }, output_tokens_details: { reasoning_tokens: 2 } } });
  }
  return { connection, store, sessions, owner, context, nativeOwner, preview, service, dependencies, requests,
    holdAnswer(gate: Promise<void>) { answerGate = gate; },
    start: () => service.start(owner, { requestId: crypto.randomUUID(), consent: true,
      question: "Explique a confirmação e os limites deste serviço.", binding: {
        grantId: preview.grantId, revision: preview.revision, snapshotSha256: preview.snapshotSha256 } }),
    tool(name: string, args: unknown, callId = crypto.randomUUID()) {
      response([{ type: "function_call", id: `fc_${callId}`, call_id: callId, name, arguments: JSON.stringify(args), status: "completed" }]);
    },
    answer(text: string) { response([{ type: "message", id: crypto.randomUUID(), role: "assistant", status: "completed",
      content: [{ type: "output_text", text, annotations: [] }] }]); },
    incomplete() { response([], "incomplete"); },
    model(value: Omit<AgentModel, "fingerprint"> & { fingerprint?: string }) {
      model = { ...value, fingerprint: value.fingerprint ?? provider.fingerprint };
    },
    authorize(value: boolean) { authorized = value; }, advance(milliseconds: number) { instant += milliseconds; },
    async close() { await service.close(); context.close(); connection.close(); },
  };
}
