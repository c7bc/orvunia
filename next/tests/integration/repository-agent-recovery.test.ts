import { afterEach, expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";
import type { AgentStore } from "../../packages/repository-agent/domain.ts";
import { agentLimits } from "../../packages/repository-agent/limits.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const fixtures: Awaited<ReturnType<typeof repositoryAgentFixture>>[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((value) => value.close()));
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), "orvunia-agent-"))) throw Error("Unexpected test path");
    rmSync(directory, { recursive: true, force: true });
  }
});
async function fixture() { const value = await repositoryAgentFixture(); fixtures.push(value); return value; }
const signal = () => new AbortController().signal;

test("two service instances claim one invocation before reserving shared commercial allowance", async () => {
  const context = await fixture();
  let calls = 0;
  context.model({ async turn() {
    calls++;
    return { output: [], calls: [], text: "No repository evidence was read.", model: "controlled",
      inputTokens: 10, outputTokens: 3, cachedInputTokens: 0, reasoningTokens: 0 };
  } });
  const other = createRepositoryAgent(context.dependencies);
  const job = await context.start();
  const results = await Promise.allSettled([
    context.service.advance(context.owner, job.id, signal()), other.advance(context.owner, job.id, signal()),
  ]);
  expect(calls).toBe(1);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const reservations = context.connection.client.query<{ state: string; actual: number }, []>("SELECT state,actual FROM next_usage").all();
  expect(reservations).toEqual([{ state: "committed", actual: 1 }]);
  expect((await other.advance(context.owner, job.id, signal())).status).toBe("completed");
  expect(calls).toBe(1);
  await other.close();
});

test("known technical usage survives a crash before commercial commit and recovery refuses reinference", async () => {
  const context = await fixture(); const job = await context.start();
  const crashed = createRepositoryAgent({ ...context.dependencies, accounting: { ...context.dependencies.accounting,
    commit: async () => { throw Error("Controlled commit crash"); } } });
  context.answer("Known result before interrupted commit.");
  await expect(crashed.advance(context.owner, job.id, signal())).rejects.toThrow("Controlled commit crash");
  context.advance(agentLimits.callMilliseconds + 5_001);
  expect((await context.service.advance(context.owner, job.id, signal())).status).toBe("unknown");
  expect(context.requests).toHaveLength(1);
  const record = context.connection.client.query<{ payload: string }, []>("SELECT payload FROM repository_agent_usage").get()!;
  expect(JSON.parse(record.payload)).toMatchObject({ state: "known", inputTokens: 100, outputTokens: 20 });
  expect(context.connection.client.query<{ state: string }, []>("SELECT state FROM next_usage").get()?.state).toBe("unknown");
  await crashed.close();
});

test("crash after commit before result checkpoint neither loses usage nor triggers another paid call", async () => {
  const context = await fixture(); const job = await context.start();
  const broken: AgentStore = { ...context.store,
    async save(next, version) { if (next.status === "completed") throw Error("Controlled checkpoint crash");
      return context.store.save(next, version); } };
  const crashed = createRepositoryAgent({ ...context.dependencies, store: broken });
  context.answer("Result cannot be safely replayed because its checkpoint failed.");
  await expect(crashed.advance(context.owner, job.id, signal())).rejects.toThrow("Controlled checkpoint crash");
  context.advance(agentLimits.callMilliseconds + 5_001);
  expect((await context.service.advance(context.owner, job.id, signal())).status).toBe("unknown");
  expect(context.requests).toHaveLength(1);
  expect(context.connection.client.query<{ state: string; actual: number }, []>("SELECT state,actual FROM next_usage").get())
    .toEqual({ state: "committed", actual: 1 });
  expect(context.connection.client.query<{ state: string }, []>("SELECT state FROM repository_agent_usage").get()?.state).toBe("known");
  await crashed.close();
});

test("cancellation during usage commit wins before final checkpoint and never appends", async () => {
  const context = await fixture(); const job = await context.start();
  let entered!: () => void, release!: () => void;
  const committing = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const service = createRepositoryAgent({ ...context.dependencies, accounting: { ...context.dependencies.accounting,
    async commit(...args) { entered(); await gate; return context.dependencies.accounting.commit(...args); } } });
  context.answer("A result discarded on cancellation.");
  const running = service.advance(context.owner, job.id, signal());
  await committing;
  const cancellation = service.cancel(context.owner, job.id);
  await Promise.resolve(); release();
  expect((await running).status).toBe("cancelled");
  expect((await cancellation).status).toBe("cancelled");
  expect(await context.sessions.entries(context.owner.workspaceId, context.owner.sessionId, "responses", { limit: 10 })).toHaveLength(0);
  await service.close();
});

test("provider/configuration change is rejected before reserve or call", async () => {
  const context = await fixture(); const job = await context.start();
  let calls = 0;
  context.model({ fingerprint: "changed", async turn() { calls++; throw Error("Must not invoke"); } });
  await expect(context.service.advance(context.owner, job.id, signal())).rejects.toMatchObject({ code: "repository_provider_changed" });
  expect(calls).toBe(0);
  expect(context.connection.client.query("SELECT * FROM next_usage").all()).toHaveLength(0);
});

test("four technical rounds consume four commercial generations and preserve every measured turn", async () => {
  const context = await fixture(); let job = await context.start();
  const steps = [
    { name: "repository_list", args: {}, result: context.context.list(context.nativeOwner, context.preview) },
    { name: "repository_search", args: { query: "confirm", path: null },
      result: context.context.search(context.nativeOwner, context.preview, { query: "confirm" }) },
    { name: "repository_read", args: { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 },
      result: context.context.read(context.nativeOwner, context.preview,
        { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 }) },
  ];
  for (const step of steps) {
    context.tool(step.name, step.args);
    job = await context.service.advance(context.owner, job.id, signal());
    const pending = job.pending.find((call) => call.result === undefined)!;
    job = await context.service.reply(context.owner, job.id, { callId: pending.callId, token: pending.token,
      result: step.result });
  }
  context.answer("Final measured response.");
  job = await context.service.advance(context.owner, job.id, signal());
  expect(job.status).toBe("completed");
  expect(context.requests[3]?.tool_choice).toBe("auto");
  expect(context.connection.client.query<{ count: number; actual: number }, []>(
    "SELECT COUNT(*) AS count,SUM(actual) AS actual FROM next_usage").get()).toEqual({ count: 4, actual: 4 });
  expect(context.connection.client.query("SELECT * FROM repository_agent_usage").all()).toHaveLength(4);
});

test("file-backed SQLite restart resumes a completed tool checkpoint without repeating the first inference", async () => {
  const directory = mkdtempSync(join(tmpdir(), "orvunia-agent-")); directories.push(directory);
  const filename = join(directory, "agent.sqlite");
  const first = await repositoryAgentFixture(filename); fixtures.push(first);
  let job = await first.start();
  first.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 });
  job = await first.service.advance(first.owner, job.id, signal());
  await first.service.close();
  const restarted = await repositoryAgentFixture(filename); fixtures.push(restarted);
  const loaded = await restarted.service.get(first.owner, job.id);
  expect(loaded.status).toBe("waiting_tools");
  const pending = loaded.pending[0]!;
  const result = first.context.read(first.nativeOwner, first.preview,
    { path: "src/application/inventory.ts", fromLine: 41, toLine: 48 });
  await restarted.service.reply(first.owner, loaded.id, { callId: pending.callId, token: pending.token, result });
  restarted.answer(`Read src/application/inventory.ts:41-48 revision1 hash ${result.sha256}.`);
  expect((await restarted.service.advance(first.owner, loaded.id, signal())).status).toBe("completed");
  expect(first.requests).toHaveLength(1); expect(restarted.requests).toHaveLength(1);
  expect(await restarted.sessions.entries(first.owner.workspaceId, first.owner.sessionId, "responses", { limit: 10 })).toHaveLength(1);
});

test("incomplete provider response with reported usage remains measured and never triggers automatic retry", async () => {
  const context = await fixture(); const job = await context.start();
  context.incomplete();
  const result = await context.service.advance(context.owner, job.id, signal());
  expect(result.status).toBe("failed");
  expect(result.error).toBe("repository_provider_incomplete");
  expect((await context.service.advance(context.owner, job.id, signal())).status).toBe("failed");
  expect(context.requests).toHaveLength(1);
  const usage = context.connection.client.query<{ payload: string }, []>("SELECT payload FROM repository_agent_usage").get()!;
  expect(JSON.parse(usage.payload)).toMatchObject({ state: "known", inputTokens: 100, outputTokens: 20 });
});
