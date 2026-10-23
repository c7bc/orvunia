import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteAccounting } from "../../packages/storage/sqlite/accounting.ts";
import { localAccounting } from "../../packages/accounting/service.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { SqliteOperations } from "../../packages/storage/sqlite/operations.ts";
import { SqliteOperationStages } from "../../packages/storage/sqlite/operation-stages.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteAssets } from "../../packages/storage/sqlite/assets.ts";
import { filesystemObjects } from "../../packages/assets/filesystem.ts";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { connectionService } from "../../packages/connections/service.ts";
import type { Configuration } from "../../packages/connections/domain.ts";
import { capabilityRouter } from "../../packages/capabilities/router.ts";
import { answers } from "../../packages/answers/service.ts";
import type { AnswerDependencies } from "../../packages/answers/dependencies.ts";
import { assets as assetService } from "../../packages/assets/service.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { providerSettings } from "../../packages/providers/settings.ts";
import { providerDefaults } from "../../packages/providers/defaults.ts";
import { answerSchema } from "../../packages/contracts/answers.ts";
import { providerStream } from "./provider-stream.ts";
import type { HttpFetch } from "../../packages/providers/http.ts";
import type { RuntimeBinary } from "../../packages/local-models/runtime.ts";

export async function capabilityEnvironment(runtimes?: { llama?: RuntimeBinary; whisper?: RuntimeBinary }) {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-capabilities-"));
  const connection = sqliteConnection(":memory:"); await migrateSqlite(connection);
  let now = Date.now();
  const owner = crypto.randomUUID();
  const sessions = new SqliteSessions(connection);
  const operations = new SqliteOperations(connection);
  const assetRepository = new SqliteAssets(connection);
  const objects = await filesystemObjects(join(directory, "objects"));
  const session = await sessions.create({ id: crypto.randomUUID(), workspaceId: owner, title: "Synthetic capability session",
    mode: "technical", state: "active", createdAt: new Date(now).toISOString(), elapsed: 0, question: "", modeSnapshot: null,
    historyGeneration: 0, revision: 0 });
  const meter = localAccounting(new SqliteAccounting(connection), () => crypto.randomUUID(), () => now);
  const workspace = workspaces(new SqliteWorkspaces(connection), () => new Date(now));
  const providers = await providerSettings({ initial: providerDefaults({}), editable: false, protection: "file", environmentKey: () => "synthetic-key" });
  let configuration: Configuration = { schemaVersion: 2, revision: 1,
    connections: [
      { id: "text", provider: "openai", baseUrl: "https://text.fixture.test/v1", model: "text-snapshot", revision: 1,
        capabilities: ["text"], parameters: { maxTokens: 128 }, secretRef: "text-key" },
      { id: "vision", provider: "openai", baseUrl: "https://vision.fixture.test/v1", model: "vision-snapshot", revision: 1,
        capabilities: ["vision"], parameters: { maxTokens: 128 }, secretRef: "vision-key" },
      { id: "speech", provider: "openai", baseUrl: "https://speech.fixture.test/v1", model: "speech-snapshot", revision: 1,
        capabilities: ["transcription"], parameters: {}, secretRef: "speech-key" },
    ], bindings: { text: { kind: "api", connectionId: "text" }, vision: { kind: "api", connectionId: "vision" },
      transcription: { kind: "api", connectionId: "speech" } },
    secrets: { "text-key": { kind: "saved", value: "synthetic-text-secret" }, "vision-key": { kind: "saved", value: "synthetic-vision-secret" },
      "speech-key": { kind: "saved", value: "synthetic-speech-secret" } } };
  const connections = connectionService({ repository: { async read() { return structuredClone(configuration); },
    async write(value) { configuration = structuredClone(value); }, async transaction(action) { return action(); } },
    installationSupports: async () => false, environmentKey: () => "" });
  const models = composeLocalModels({ directory, database: connection.client, bindings: async () => [], ...(runtimes ? { runtimes } : {}) });
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let upstream: HttpFetch = async (url) => providerStream([
    { type: "response.output_text.delta", delta: String(url).includes("vision.") ? "Visible TypeScript question" : "Final technical answer" },
    { type: "response.completed", response: { usage: { input_tokens: 20, output_tokens: 5 } } },
  ]);
  const router = capabilityRouter({ connections, models: models.service, transport: async (url, options) => {
    requests.push({ url: String(url), body: typeof options?.body === "string" ? JSON.parse(options.body) as Record<string, unknown> : {} });
    return upstream(url, options);
  } });
  const dependencies: AnswerDependencies = { sessions, workspace, assets: assetRepository, objects, operations,
    providers, capabilities: router, operationStages: new SqliteOperationStages(connection), usage: meter,
    transport: async () => { throw Error("Capability test must use its explicit router transport"); },
    clock: () => now, identifier: () => crypto.randomUUID(), log() {}, heartbeatMs: 5 };
  const service = answers(dependencies);
  const input = answerSchema.parse({ requestId: crypto.randomUUID(), mode: "technical", action: "assist", question: "Synthetic question" });
  const prepare = () => service.prepare(owner, session.id, input, false);
  const run = (operation: Awaited<ReturnType<typeof prepare>>, delta: (text: string) => void = () => {}) =>
    service.run(operation, new AbortController().signal, delta, async () => true);
  const imageService = assetService({ repository: assetRepository, objects, maximumBytes: 128 * 1024 ** 2,
    clock: () => now, identifier: () => crypto.randomUUID() });
  return { dependencies, service, input, prepare, run, owner, session, sessions, operations, workspace, imageService,
    router, requests, connection, models, now: () => now, advance: (milliseconds: number) => { now += milliseconds; },
    reservation: async () => (await meter.reserve(owner, "answers", 1, crypto.randomUUID())).id,
    config: () => configuration, change: (action: (value: Configuration) => void) => action(configuration),
    upstream: (transport: HttpFetch) => { upstream = transport; },
    async close() { await service.close(); await models.close(); connection.close(); await rm(directory, { recursive: true, force: true }); },
  };
}
