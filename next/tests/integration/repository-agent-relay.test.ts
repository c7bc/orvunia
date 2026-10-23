import { afterEach, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryAgentRoutes } from "../../apps/api/repository-agent.ts";
import { createRepositoryAgentRunner } from "../../../client/repository/agent-runner.ts";
import type { RepositoryBinding } from "../../../client/repository/contracts.ts";
import { HttpError } from "../../packages/http/errors.ts";

const fixtures: Awaited<ReturnType<typeof repositoryAgentFixture>>[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map((value) => value.close())); });
async function fixture() { const value = await repositoryAgentFixture(); fixtures.push(value); return value; }

test("renderer runner traverses real Elysia authenticated relay with approved repository tools", async () => {
  const context = await fixture();
  const app = new Elysia().use(repositoryAgentRoutes(context.service, {
    resolve: async (request) => request.headers.get("x-fixture-actor") === "owner"
      ? { workspaceId: context.owner.workspaceId, userId: context.owner.actorId, locale: "pt-BR" } : null,
  }, context.sessions, "/api/v1"));
  context.tool("repository_list", {});
  context.tool("repository_search", { query: "confirm", path: null });
  context.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 });
  const reading = context.context.read(context.nativeOwner, context.preview,
    { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 });
  context.answer(`Revisão 1: src/application/inventory.ts:41-48 sha256 ${reading.sha256}: confirmação idempotente.`);
  const states: string[] = [], tools: string[] = [];
  const runner = createRepositoryAgentRunner({
    async request(path, options, signal) {
      const response = await app.handle(new Request(`http://fixture.local/api/v1${path}`, {
        ...options, signal, headers: { "Content-Type": "application/json", "x-fixture-actor": "owner" },
      }));
      expect(response.ok).toBe(true);
      return response.json();
    },
    async execute(call, binding) {
      tools.push(call.name);
      const args = JSON.parse(call.arguments) as { query: string; path: string | null; fromLine: number; toLine: number };
      if (call.name === "repository_list") return context.context.list(context.nativeOwner, binding);
      if (call.name === "repository_search") return context.context.search(context.nativeOwner, binding,
        { query: args.query, ...(args.path ? { path: args.path } : {}) });
      return context.context.read(context.nativeOwner, binding,
        { path: args.path!, fromLine: args.fromLine, toLine: args.toLine });
    },
    onChange(job) { states.push(job.status); },
  });
  const binding: RepositoryBinding = { grantId: context.preview.grantId, revision: context.preview.revision,
    snapshotSha256: context.preview.snapshotSha256 };
  const result = await runner.run(context.owner.sessionId, "Explique a confirmação", binding, new AbortController().signal);
  expect(result.status).toBe("completed");
  expect(result.answer).toContain(reading.sha256);
  expect(tools).toEqual(["repository_list", "repository_search", "repository_read"]);
  expect(states.filter((state) => state === "waiting_tools")).toHaveLength(3);
  expect(context.requests).toHaveLength(4);
  expect(JSON.stringify(result)).not.toContain("controlled-fixture");
});

test("binding ownership, session ownership, consent and relay tokens are enforced", async () => {
  const context = await fixture();
  let userId = context.owner.actorId, workspaceId = context.owner.workspaceId;
  const app = new Elysia().onError(({ error, set }) => {
    if (error instanceof HttpError) { set.status = error.status; return { error: { code: error.code } }; }
  }).use(repositoryAgentRoutes(context.service, { resolve: async () => ({ userId, workspaceId, locale: "en" }) },
    context.sessions, "/api/v1"));
  const base = `http://fixture.local/api/v1/sessions/${context.owner.sessionId}/repository-agent`;
  const binding = await (await app.handle(new Request(`${base}/binding`))).json() as Record<string, unknown>;
  expect(String(binding.workspaceId)).toHaveLength(24);
  expect(String(binding.actorId)).toHaveLength(24);
  expect(JSON.stringify(binding)).not.toContain(context.owner.workspaceId);
  const denied = await app.handle(new Request(`${base}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: crypto.randomUUID(), consent: false, question: "Review", binding: context.preview }) }));
  expect(denied.status).toBe(422);
  const job = await context.start(); context.tool("repository_list", {});
  const waiting = await context.service.advance(context.owner, job.id, new AbortController().signal);
  await expect(context.service.reply(context.owner, job.id, { callId: waiting.pending[0]!.callId,
    token: crypto.randomUUID(), result: context.context.list(context.nativeOwner, context.preview) }))
    .rejects.toMatchObject({ code: "repository_tool_not_found" });
  userId = crypto.randomUUID();
  const foreignActor = await app.handle(new Request(`${base}/jobs/${job.id}`));
  expect(foreignActor.status).toBe(404);
  workspaceId = crypto.randomUUID();
  expect((await app.handle(new Request(`${base}/binding`))).status).toBe(404);
  expect(context.requests).toHaveLength(1);
});

test("cancellation waits for in-flight model drain and stores known usage when response arrives", async () => {
  const context = await fixture();
  let entered!: () => void, drained!: () => void, released!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const aborted = new Promise<void>((resolve) => { drained = resolve; });
  const gate = new Promise<void>((resolve) => { released = resolve; });
  context.model({ async turn(_messages, _maximum, signal) {
    signal.addEventListener("abort", drained, { once: true }); entered(); await gate;
    return { output: [], calls: [], text: "Late", model: "controlled-drain", inputTokens: 10,
      outputTokens: 2, cachedInputTokens: 0, reasoningTokens: 0 };
  } });
  const job = await context.start();
  const running = context.service.advance(context.owner, job.id, new AbortController().signal);
  await started;
  let cancelled = false;
  const cancellation = context.service.cancel(context.owner, job.id).then((value) => { cancelled = true; return value; });
  await aborted;
  expect(cancelled).toBe(false);
  released();
  expect((await cancellation).status).toBe("cancelled");
  expect((await running).status).toBe("cancelled");
  const rows = context.connection.client.query<{ payload: string }, []>("SELECT payload FROM repository_agent_usage").all();
  expect(JSON.parse(rows[0]!.payload)).toMatchObject({ state: "known", inputTokens: 10, outputTokens: 2 });
  expect(await context.sessions.entries(context.owner.workspaceId, context.owner.sessionId, "responses", { limit: 10 })).toHaveLength(0);
});
