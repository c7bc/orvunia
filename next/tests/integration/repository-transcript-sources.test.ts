import { expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { startSchema } from "../../packages/repository-agent/contracts.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";

type Fixture = Awaited<ReturnType<typeof repositoryAgentFixture>>;
async function transcript(context: Fixture, sessionId = context.owner.sessionId) {
  const id = crypto.randomUUID();
  await context.sessions.change(context.owner.workspaceId, sessionId, session => ({ next: session,
    append: { id, conversationId: session.id, kind: "transcripts", segmentId: null,
      data: { id, text: "Synthetic interviewer question", who: "Interviewer", time: "00:01", source: "manual" } } }));
  return id;
}
const input = (context: Fixture, ids: string[]) => ({ requestId: crypto.randomUUID(), consent: true,
  question: "Explain this implementation", binding: { grantId: context.preview.grantId,
    revision: context.preview.revision, snapshotSha256: context.preview.snapshotSha256 }, sourceTranscriptIds: ids });

test("source IDs persist through restart, completion and idempotent receipt without another provider call", async () => {
  const context = await repositoryAgentFixture();
  const restarted = createRepositoryAgent(context.dependencies);
  try {
    const sources = [await transcript(context), await transcript(context)];
    const request = input(context, sources);
    const job = await context.service.start(context.owner, request);
    expect(job.sourceTranscriptIds).toEqual(sources);
    context.answer("Controlled answer fixture");
    const completed = await restarted.advance(context.owner, job.id, new AbortController().signal);
    expect(completed.status).toBe("completed");
    const answer = await context.sessions.entry(context.owner.workspaceId, context.owner.sessionId, job.id, "responses");
    expect(answer?.data.sourceTranscriptIds).toEqual(sources);
    expect((await context.store.find(context.owner, job.id))?.sourceTranscriptIds).toEqual(sources);
    expect((await restarted.start(context.owner, request)).id).toBe(job.id);
    expect(context.requests).toHaveLength(1);
    await expect(restarted.start(context.owner, { ...request, sourceTranscriptIds: [sources[0]] }))
      .rejects.toMatchObject({ code: "repository_request_conflict" });
    expect(context.requests).toHaveLength(1);
  } finally { await restarted.close(); await context.close(); }
});

test("invalid shape and cross-session source IDs are rejected before job creation or inference", async () => {
  const context = await repositoryAgentFixture();
  try {
    const original = (await context.sessions.find(context.owner.workspaceId, context.owner.sessionId))!;
    const other = await context.sessions.create({ ...original, id: crypto.randomUUID() });
    const foreign = await transcript(context, other.id);
    const request = input(context, [foreign]);
    await expect(context.service.start(context.owner, request)).rejects.toMatchObject({ code: "history_changed" });
    expect(await context.store.receipt(context.owner, request.requestId)).toBeNull();
    expect(context.requests).toHaveLength(0);
    for (const ids of [[foreign, foreign], ["not-a-uuid"], Array.from({ length: 81 }, () => crypto.randomUUID())])
      expect(startSchema.safeParse(input(context, ids)).success).toBe(false);
    await expect(context.service.start({ ...context.owner, workspaceId: crypto.randomUUID() }, request)).rejects.toThrow();
    expect(context.requests).toHaveLength(0);
  } finally { await context.close(); }
});

test("deleting a source tombstones the receipt and scrubs its linkage without paid replay", async () => {
  const context = await repositoryAgentFixture();
  try {
    const id = await transcript(context), request = input(context, [id]);
    const job = await context.service.start(context.owner, request);
    await context.sessions.change(context.owner.workspaceId, context.owner.sessionId, session => ({ next: session, remove: id }));
    const cancelled = await context.service.advance(context.owner, job.id, new AbortController().signal);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.sourceTranscriptIds).toEqual([]);
    expect(cancelled.messages).toEqual([]);
    expect((await context.service.start(context.owner, request)).id).toBe(job.id);
    expect(context.requests).toHaveLength(0);
    expect(await context.sessions.entry(context.owner.workspaceId, context.owner.sessionId, job.id, "responses")).toBeNull();
  } finally { await context.close(); }
});

test("each subsequent inference revalidates active session and source history after local tool replies", async () => {
  const context = await repositoryAgentFixture();
  try {
    const id = await transcript(context), job = await context.service.start(context.owner, input(context, [id]));
    context.tool("repository_list", {});
    const waiting = await context.service.advance(context.owner, job.id, new AbortController().signal);
    const call = waiting.pending[0]!;
    await context.service.reply(context.owner, job.id, { callId: call.callId, token: call.token,
      result: context.context.list(context.nativeOwner, context.preview) });
    await context.sessions.change(context.owner.workspaceId, context.owner.sessionId, session => ({ next: { ...session, state: "paused" } }));
    await expect(context.service.advance(context.owner, job.id, new AbortController().signal))
      .rejects.toMatchObject({ code: "conversation_ended" });
    expect(context.requests).toHaveLength(1);
    expect((await context.store.find(context.owner, job.id))?.status).toBe("ready");
  } finally { await context.close(); }
});
