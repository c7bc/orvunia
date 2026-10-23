import { afterEach, expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import type { AgentJob } from "../../packages/repository-agent/domain.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";
import { repositoryAgentView } from "../../packages/repository-agent/presentation.ts";

const fixtures: Awaited<ReturnType<typeof repositoryAgentFixture>>[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map((value) => value.close())); });
async function fixture() { const value = await repositoryAgentFixture(); fixtures.push(value); return value; }
const signal = () => new AbortController().signal;
async function reply(context: Awaited<ReturnType<typeof fixture>>, job: AgentJob, result: unknown) {
  const pending = job.pending.find((entry) => entry.result === undefined)!;
  return context.service.reply(context.owner, job.id, { callId: pending.callId, token: pending.token, result });
}

test("real Responses function calling lists, searches, reads approved real fixture and persists cited answer once", async () => {
  const context = await fixture();
  const { service, owner, preview, nativeOwner } = context;
  let job = await context.start();
  context.tool("repository_list", {});
  job = await service.advance(owner, job.id, signal());
  expect(job.status).toBe("waiting_tools");
  job = await reply(context, job, context.context.list(nativeOwner, preview));
  context.tool("repository_search", { query: "confirm", path: "src/application/inventory.ts" });
  job = await service.advance(owner, job.id, signal());
  job = await reply(context, job, context.context.search(nativeOwner, preview,
    { query: "confirm", path: "src/application/inventory.ts" }));
  context.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 41, toLine: 52 });
  job = await service.advance(owner, job.id, signal());
  const reading = context.context.read(nativeOwner, preview, { path: "src/application/inventory.ts", fromLine: 41, toLine: 52 });
  job = await reply(context, job, reading);
  context.answer(`A confirmação verifica prazo e transição. Evidência: src/application/inventory.ts:41-52, revisão 1, sha256 ${reading.sha256}.`);
  job = await service.advance(owner, job.id, signal());
  expect(job.status).toBe("completed");
  expect(job.turns).toBe(4); expect(job.tools).toBe(3);
  expect(context.requests).toHaveLength(4);
  expect(context.requests[3]?.input).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "function_call_output", output: expect.any(String) }),
  ]));
  const evidence = (context.requests[3]?.input as { type: string; call_id?: string; output?: string }[])
    .findLast(item => item.type === "function_call_output")!;
  expect(JSON.parse(evidence.output!)).toMatchObject({ path: reading.path, sha256: reading.sha256,
    sourceLines: [{ line: 41, text: reading.text.split(/\r?\n/)[0] }, ...reading.text.split(/\r?\n/).slice(1)
      .map((text, index) => ({ line: 42 + index, text }))] });
  expect(context.requests.every((request) => request.store === false && request.stream === true)).toBe(true);
  expect(context.requests[0]?.tools).toHaveLength(3);
  await service.advance(owner, job.id, signal());
  await service.get(owner, job.id);
  expect(context.requests).toHaveLength(4);
  expect((await context.sessions.entries(owner.workspaceId, owner.sessionId, "responses", { limit: 10 }))).toHaveLength(1);
  const usage = context.connection.client.query<{ state: string; payload: string }, []>(
    "SELECT state,payload FROM repository_agent_usage ORDER BY turn").all();
  expect(usage).toHaveLength(4);
  const debits = context.connection.client.query<{ charged: number; reservations: number }, []>(
    "SELECT count(*) AS reservations, coalesce(sum(actual),0) AS charged FROM next_usage WHERE kind='answers' AND state='committed'").get()!;
  expect(debits.reservations).toBe(context.requests.length);
  expect(debits.charged).toBe(4);
  expect(usage.every((row) => JSON.parse(row.payload).cachedInputTokens === 5)).toBe(true);
  expect(usage.every((row) => JSON.parse(row.payload).reasoningTokens === 2)).toBe(true);
  expect(JSON.stringify(repositoryAgentView(job))).not.toContain("controlled-fixture");
});

test("start receipt conflicts on changed payload and replays without inference", async () => {
  const context = await fixture();
  const input = { requestId: crypto.randomUUID(), consent: true, question: "Review", binding: {
    grantId: context.preview.grantId, revision: 1, snapshotSha256: context.preview.snapshotSha256 } };
  const first = await context.service.start(context.owner, input);
  expect((await context.service.start(context.owner, input)).id).toBe(first.id);
  await expect(context.service.start(context.owner, { ...input, question: "Changed" })).rejects.toMatchObject({ code: "repository_request_conflict" });
  expect(context.requests).toHaveLength(0);
});

test("traversal from provider is rejected before relay and response is still metered", async () => {
  const context = await fixture();
  const job = await context.start();
  context.tool("repository_read", { path: "../.env", fromLine: 1, toLine: 2 });
  await expect(context.service.advance(context.owner, job.id, signal())).rejects.toMatchObject({ code: "repository_tool_invalid" });
  expect((await context.service.get(context.owner, job.id)).status).toBe("failed");
  expect(context.connection.client.query("SELECT * FROM repository_agent_usage").all()).toHaveLength(1);
});

test("revision mismatch and sensitive output never enter model history", async () => {
  const context = await fixture();
  let job = await context.start();
  context.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 1 });
  job = await context.service.advance(context.owner, job.id, signal());
  const result = context.context.read(context.nativeOwner, context.preview,
    { path: "src/application/inventory.ts", fromLine: 1, toLine: 1 });
  await expect(reply(context, job, { ...result, revision: 2 })).rejects.toMatchObject({ code: "repository_revision_changed" });
  await expect(reply(context, job, { ...result, text: `sk-proj-${"a".repeat(30)}` })).rejects.toMatchObject({ code: "repository_sensitive_result" });
  expect((await context.service.get(context.owner, job.id)).messages).toHaveLength(2);
});

test("tool receipt remains idempotent after final response without another call", async () => {
  const context = await fixture(); let job = await context.start();
  context.tool("repository_list", {}); job = await context.service.advance(context.owner, job.id, signal());
  const pending = job.pending[0]!;
  const result = context.context.list(context.nativeOwner, context.preview);
  job = await reply(context, job, result);
  context.answer("Observed inventory service."); job = await context.service.advance(context.owner, job.id, signal());
  const replay = await context.service.reply(context.owner, job.id, { callId: pending.callId, token: pending.token, result });
  expect(replay.status).toBe("completed"); expect(context.requests).toHaveLength(2);
});

test("transport ambiguity persists unknown and restart never repeats provider", async () => {
  const context = await fixture(); const job = await context.start();
  let calls = 0;
  context.model({ async turn() { calls++; throw Error("Connection closed after dispatch"); } });
  await expect(context.service.advance(context.owner, job.id, signal())).rejects.toThrow("Connection closed");
  const restarted = createRepositoryAgent(context.dependencies);
  expect((await restarted.advance(context.owner, job.id, signal())).status).toBe("unknown");
  expect(calls).toBe(1);
  const row = context.connection.client.query<{ payload: string }, []>("SELECT payload FROM repository_agent_usage").get()!;
  expect(JSON.parse(row.payload)).toMatchObject({ state: "unknown", inputTokens: null });
  await restarted.close();
});

test("history clear scrubs context and preserves terminal receipt without reinference", async () => {
  const context = await fixture(); const job = await context.start();
  await context.sessions.change(context.owner.workspaceId, context.owner.sessionId, (session) =>
    ({ next: { ...session, historyGeneration: session.historyGeneration + 1 }, clear: "responses" }));
  const stopped = await context.service.advance(context.owner, job.id, signal());
  expect(stopped.status).toBe("cancelled");
  expect(stopped.messages).toEqual([]);
  expect(stopped.answer).toBeNull();
  expect(context.requests).toHaveLength(0);
  expect(await context.sessions.entries(context.owner.workspaceId, context.owner.sessionId, "responses", { limit: 10 })).toHaveLength(0);
});
