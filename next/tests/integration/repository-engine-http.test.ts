import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryAgentRoutes } from "../../apps/api/repository-agent.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";
import { createRepositoryAgentRunner } from "../../../client/repository/agent-runner.ts";
import { executeRepositoryTool } from "../../../client/repository/native-tools.ts";
import type { RepositoryBinding } from "../../packages/repository-agent/domain.ts";

test("engine SDK crosses real HTTP, Elysia, SQLite and native tools, correcting errors and continuing context", async () => {
  const fixture = await repositoryAgentFixture();
  const identity = { resolve: async () => ({ userId: fixture.owner.actorId,
    workspaceId: fixture.owner.workspaceId, locale: "pt-BR" as const }) };
  const app = repositoryAgentRoutes(fixture.service, identity, fixture.sessions, "/api").listen({ hostname: "127.0.0.1", port: 0 });
  const native = createNativeRepositoryHandler({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => fixture.owner.sessionId, binding: async () => fixture.owner,
    choose: async () => ({ canceled: false, filePaths: [resolve(import.meta.dir, "../fixtures/repository")] }) });
  try {
    const selected = await native.invoke("engine", { ...fixture.owner, action: "select", scope: ["src"] }) as RepositoryBinding;
    const binding = { grantId: selected.grantId, revision: selected.revision, snapshotSha256: selected.snapshotSha256 };
    await native.invoke("engine", { ...fixture.owner, ...binding, action: "approve", consent: true });
    const requests: string[] = [];
    const request = async (path: string, options: RequestInit) => {
      requests.push(`${options.method} ${path}`);
      const response = await fetch(`http://127.0.0.1:${app.server!.port}/api${path}`, options);
      if (!response.ok) throw Error(`Repository HTTP ${response.status}`);
      return response.json();
    };
    const sdk = createRepositoryAgentRunner({ request, onChange() {}, execute: (call, current, signal) =>
      executeRepositoryTool((value) => native.invoke("engine", value), fixture.owner, current, call, signal) });
    fixture.tool("repository_read", { path: "src/missing.ts", fromLine: 1, toLine: 5 });
    fixture.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 200 });
    fixture.answer("Observed src/application/inventory.ts with actual read evidence.");
    const first = await sdk.run(fixture.owner.sessionId, "Explain reservation", binding, AbortSignal.timeout(10_000));
    expect(first.status).toBe("completed"); expect(first.tools).toBe(2);
    expect(requests.filter((entry) => entry.endsWith("/tools"))).toHaveLength(2);
    fixture.answer("Follow-up based on the previously read reservation flow.");
    const second = await sdk.run(fixture.owner.sessionId, "What follows from this?", binding, AbortSignal.timeout(10_000));
    expect(second.status).toBe("completed");
    expect(JSON.stringify(fixture.requests.at(-1)?.input)).toContain("repository_file_not_found");
    expect(JSON.stringify(fixture.requests.at(-1)?.input)).toContain("src/application/inventory.ts");
    expect(await fixture.sessions.counts(fixture.owner.workspaceId, fixture.owner.sessionId))
      .toMatchObject({ responses: 2 });
  } finally { native.close(); await app.stop(true); await fixture.close(); }
});

test("SDK resumes an existing durable ready job after engine restart without a new receipt or duplicate answer", async () => {
  const fixture = await repositoryAgentFixture();
  const first = await fixture.start();
  await fixture.service.close();
  const service = createRepositoryAgent(fixture.dependencies);
  const app = repositoryAgentRoutes(service, { resolve: async () => ({ userId: fixture.owner.actorId,
    workspaceId: fixture.owner.workspaceId, locale: "en" as const }) }, fixture.sessions, "/api")
    .listen({ hostname: "127.0.0.1", port: 0 });
  try {
    fixture.answer("Resumed once without another start.");
    const requests: string[] = [];
    const sdk = createRepositoryAgentRunner({ onChange() {}, async execute() { throw Error("No tool expected"); },
      async request(path, options) {
        requests.push(`${options.method} ${path}`);
        const response = await fetch(`http://127.0.0.1:${app.server!.port}/api${path}`, options);
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        return response.json();
      } });
    const completed = await sdk.resume(fixture.owner.sessionId, first.id, first.binding, AbortSignal.timeout(10_000));
    expect(completed.status).toBe("completed");
    await sdk.resume(fixture.owner.sessionId, first.id, first.binding, AbortSignal.timeout(10_000));
    expect(requests.filter((entry) => entry.startsWith("POST"))).toHaveLength(1);
    expect(fixture.requests).toHaveLength(1);
    expect((await fixture.sessions.counts(fixture.owner.workspaceId, fixture.owner.sessionId)).responses).toBe(1);
  } finally { await app.stop(true); await service.close(); await fixture.close(); }
});

test("SDK observing an in-flight job never cancels or dispatches a second inference", async () => {
  const fixture = await repositoryAgentFixture();
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  fixture.model({ async turn() { entered(); await waiting; return { output: [], calls: [], text: "Completed once",
    model: "controlled", inputTokens: 10, outputTokens: 2, cachedInputTokens: 0, reasoningTokens: 0 }; } });
  const initial = await fixture.start();
  const app = repositoryAgentRoutes(fixture.service, { resolve: async () => ({ userId: fixture.owner.actorId,
    workspaceId: fixture.owner.workspaceId, locale: "en" as const }) }, fixture.sessions, "/api")
    .listen({ hostname: "127.0.0.1", port: 0 });
  const pending = fixture.service.advance(fixture.owner, initial.id, new AbortController().signal);
  try {
    await started;
    const requests: string[] = [];
    const sdk = createRepositoryAgentRunner({ onChange() {}, async execute() { throw Error("Unexpected tool"); },
      async request(path, options) {
        requests.push(options.method!);
        const response = await fetch(`http://127.0.0.1:${app.server!.port}/api${path}`, options);
        return response.json();
      } });
    const observed = await sdk.resume(fixture.owner.sessionId, initial.id, initial.binding, AbortSignal.timeout(5000));
    expect(observed.status).toBe("invoking"); expect(requests).toEqual(["GET"]);
    expect((await fixture.store.find(fixture.owner, initial.id))?.cancelRequested).toBe(false);
  } finally { release(); await pending; await app.stop(true); await fixture.close(); }
});
