import { afterEach, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryAgentRoutes } from "../../apps/api/repository-agent.ts";
import { createRepositoryAgentRunner } from "../../../client/repository/agent-runner.ts";
import { streamRepositoryTurn } from "../../../client/repository/stream.ts";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";
import { repositoryProviderStream } from "../support/repository-provider.ts";
const fixtures: Awaited<ReturnType<typeof repositoryAgentFixture>>[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map(value => value.close())); });
function gate() { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() }; }

test("actual SDK SSE crosses Elysia and renderer before terminal completion and persists the final answer once", async () => {
  const context = await repositoryAgentFixture(); fixtures.push(context);
  const blocked = gate(), first = gate(), text: string[] = [];
  context.holdAnswer(blocked.promise);
  context.answer("Eu começo pela função de reserva. Depois verifico a disponibilidade.");
  const app = new Elysia().use(repositoryAgentRoutes(context.service, {
    resolve: async () => ({ workspaceId: context.owner.workspaceId, userId: context.owner.actorId, locale: "pt-BR" }),
  }, context.sessions, "/api"));
  const runner = createRepositoryAgentRunner({
    async request(path, options) { return (await app.handle(new Request("http://fixture.local/api" + path, options))).json(); },
    stream: (path, signal) => streamRepositoryTurn((url, options) => app.handle(new Request("http://fixture.local/api" + url, options)),
      path, signal, value => { text.push(value); if (value) first.release(); }),
    execute: async () => { throw Error("No tool was requested"); }, onChange() {},
  });
  const binding = { grantId: context.preview.grantId, revision: context.preview.revision, snapshotSha256: context.preview.snapshotSha256 };
  const running = runner.run(context.owner.sessionId, "Explique a reserva", binding, new AbortController().signal);
  try {
    await Promise.race([first.promise, Bun.sleep(1000).then(() => { throw Error("First delta was buffered"); })]);
    expect(text.at(-1)).toBe("Eu começo pe");
    expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
    expect(context.requests[0]?.stream).toBe(true);
    expect(context.requests[0]?.max_output_tokens).toBe(3000);
  } finally { blocked.release(); }
  const completed = await running;
  expect(completed.status).toBe("completed");
  expect(text.at(-1)).toBe(completed.answer!);
  expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(1);
  await context.service.advance(context.owner, completed.id, new AbortController().signal);
  expect(context.requests).toHaveLength(1);
  expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(1);
});

test("a provider disconnect after a real delta is unknown, never a saved answer or an automatic paid retry", async () => {
  const context = await repositoryAgentFixture(); fixtures.push(context);
  const deltas: string[] = [];
  const provider = openaiRepositoryModel({ provider: "openai", model: "controlled", baseUrl: "https://fixture.invalid/v1",
    apiKey: "synthetic", maxTokens: 2048, vision: false }, async () => repositoryProviderStream({
      output: [{ type: "message", id: "message", content: [{ type: "output_text", text: "Partial response" }] }],
    }, { truncate: true }));
  context.model(provider);
  const job = await context.start();
  await expect(context.service.advance(context.owner, job.id, new AbortController().signal, text => deltas.push(text))).rejects.toThrow();
  expect(deltas.join("")).toBe("Partial response");
  expect((await context.service.get(context.owner, job.id)).status).toBe("unknown");
  expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
  const rows = context.connection.client.query<{ state: string }, []>("SELECT state FROM repository_agent_usage").all();
  expect(rows).toEqual([{ state: "unknown" }]);
});

test("an unowned streaming job is rejected before any model call", async () => {
  const context = await repositoryAgentFixture(); fixtures.push(context);
  const app = new Elysia().use(repositoryAgentRoutes(context.service, {
    resolve: async () => ({ workspaceId: context.owner.workspaceId, userId: "foreign-actor", locale: "en" }),
  }, context.sessions, "/api"));
  const job = await context.start();
  const response = await app.handle(new Request(`http://fixture.local/api/sessions/${context.owner.sessionId}/repository-agent/jobs/${job.id}/advance/stream`,
    { method: "POST" }));
  expect(response.status).toBe(404);
  expect(context.requests).toHaveLength(0);
});

test("cancelling after the first streamed text never saves a partial answer or retries inference", async () => {
  const context = await repositoryAgentFixture(); fixtures.push(context);
  const blocked = gate(), first = gate(), controller = new AbortController();
  context.holdAnswer(blocked.promise); context.answer("Eu começo pela função de reserva e sigo pelo estoque.");
  const job = await context.start();
  const running = context.service.advance(context.owner, job.id, controller.signal, () => first.release());
  const result = running.then(() => null, error => error);
  try {
    await Promise.race([first.promise, Bun.sleep(1000).then(() => { throw Error("No first delta"); })]);
    controller.abort();
  } finally { blocked.release(); }
  await result;
  const ended = await context.service.get(context.owner, job.id);
  expect(["unknown", "cancelled"]).toContain(ended.status);
  expect(ended.answer).toBeNull();
  expect(context.requests).toHaveLength(1);
  expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
});
