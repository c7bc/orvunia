import { test, expect } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";

test("agent accepts a short file read requested with a 200-line upper bound and saves its answer", async () => {
  const context = await repositoryAgentFixture();
  try {
    context.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 200 });
    context.answer("Leitura confirmada do arquivo src/application/inventory.ts.");
    const job = await context.start();
    const waiting = await context.service.advance(context.owner, job.id, new AbortController().signal);
    const pending = waiting.pending[0]!;
    const result = context.context.read(context.nativeOwner, context.preview,
      { path: "src/application/inventory.ts", fromLine: 1, toLine: 200 });
    expect(result.toLine).toBeLessThan(200);
    expect(result.text.split(/\r?\n/)).toHaveLength(result.toLine);
    await context.service.reply(context.owner, job.id, { callId: pending.callId, token: pending.token, result });
    const completed = await context.service.advance(context.owner, job.id, new AbortController().signal);
    expect(completed.status).toBe("completed");
    expect(context.requests).toHaveLength(2);
    expect(await context.sessions.entries(context.owner.workspaceId, context.owner.sessionId, "responses", { limit: 10 }))
      .toHaveLength(1);
  } finally { await context.close(); }
});

test("short-read support still rejects an altered path, start line, or an end beyond the requested range", async () => {
  const context = await repositoryAgentFixture();
  try {
    context.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 5, toLine: 10 });
    const job = await context.start();
    const waiting = await context.service.advance(context.owner, job.id, new AbortController().signal);
    const pending = waiting.pending[0]!;
    const result = context.context.read(context.nativeOwner, context.preview,
      { path: "src/application/inventory.ts", fromLine: 5, toLine: 10 });
    for (const change of [{ path: "src/domain/other.ts" }, { fromLine: 4 }, { toLine: 11 }, { toLine: 4 }])
      await expect(context.service.reply(context.owner, job.id,
        { callId: pending.callId, token: pending.token, result: { ...result, ...change } }))
        .rejects.toMatchObject({ code: "repository_result_invalid" });
    expect(context.requests).toHaveLength(1);
  } finally { await context.close(); }
});
