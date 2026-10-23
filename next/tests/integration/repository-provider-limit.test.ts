import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";
import { repositoryAgentRoutes } from "../../apps/api/repository-agent.ts";
import { consumeAnswerStream } from "../../../client/coding/stream.ts";

test("a provider limit crosses SDK, repository stream and client as a localized limit without inference retries", async () => {
  const context = await repositoryAgentFixture();
  let calls = 0;
  context.model(openaiRepositoryModel({ provider: "openai", model: "controlled", apiKey: "synthetic",
    baseUrl: "https://fixture.invalid/v1", vision: false, maxTokens: 2048 }, async () => {
      calls++;
      return Response.json({ error: { code: "qa_budget_limit", message: "private provider details" } }, { status: 429 });
    }));
  try {
    const job = await context.start();
    const app = new Elysia().use(repositoryAgentRoutes(context.service, {
      resolve: async () => ({ workspaceId: context.owner.workspaceId, userId: context.owner.actorId, locale: "pt-BR" }),
    }, context.sessions, "/api"));
    const response = await app.handle(new Request(`http://fixture.local/api/sessions/${job.owner.sessionId}/repository-agent/jobs/${job.id}/advance/stream`,
      { method: "POST", headers: { "Accept-Language": "pt-BR" } }));
    await expect(consumeAnswerStream(response)).rejects.toMatchObject({ code: "provider_limit", status: 429 });
    const failed = await context.service.get(context.owner, job.id);
    expect(failed.error).toBe("repository_provider_limit");
    expect(failed.answer).toBeNull();
    await context.service.advance(context.owner, job.id, new AbortController().signal);
    expect(calls).toBe(1);
    expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
  } finally { await context.close(); }
});
