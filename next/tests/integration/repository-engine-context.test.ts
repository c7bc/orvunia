import { expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryConversation } from "../../packages/repository-agent/context.ts";
import { createRepositoryAgent } from "../../packages/repository-agent/service.ts";

test("repository follow-up retains approved tool evidence after service restart and saves the current question", async () => {
  const fixture = await repositoryAgentFixture();
  try {
    let first = await fixture.start();
    fixture.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 });
    first = await fixture.service.advance(fixture.owner, first.id, new AbortController().signal);
    const call = first.pending[0]!;
    const result = fixture.context.read(fixture.nativeOwner, fixture.preview,
      { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 });
    await fixture.service.reply(fixture.owner, first.id, { callId: call.callId, token: call.token, result });
    fixture.answer("Primeira análise com evidência.");
    first = await fixture.service.advance(fixture.owner, first.id, new AbortController().signal);
    fixture.advance(1);
    const restarted = createRepositoryAgent(fixture.dependencies);
    try {
      let next = await restarted.start(fixture.owner, { requestId: crypto.randomUUID(), consent: true,
        question: "E qual é a consequência desse fluxo?", binding: first.binding });
      expect(next.messages).toContainEqual({ kind: "tool", callId: call.callId, output: JSON.stringify(result) });
      fixture.answer("A consequência segue o fluxo que acabamos de ler.");
      next = await restarted.advance(fixture.owner, next.id, new AbortController().signal);
      const saved = await fixture.sessions.entry(fixture.owner.workspaceId, fixture.owner.sessionId, next.id, "responses");
      expect(saved?.data.question).toBe("E qual é a consequência desse fluxo?");
      expect(fixture.requests).toHaveLength(3);
    } finally { await restarted.close(); }
  } finally { await fixture.close(); }
});

test("repository context cannot cross actor, workspace, session, grant, revision, hash or cleared history", async () => {
  const fixture = await repositoryAgentFixture();
  try {
    const started = await fixture.start(); fixture.answer("Private evidence");
    const first = await fixture.service.advance(fixture.owner, started.id, new AbortController().signal);
    const variants = [
      { owner: { ...fixture.owner, actorId: "different" }, binding: first.binding, generation: 0 },
      { owner: { ...fixture.owner, workspaceId: "different" }, binding: first.binding, generation: 0 },
      { owner: { ...fixture.owner, sessionId: "different" }, binding: first.binding, generation: 0 },
      { owner: fixture.owner, binding: { ...first.binding, grantId: "different" }, generation: 0 },
      { owner: fixture.owner, binding: { ...first.binding, revision: 2 }, generation: 0 },
      { owner: fixture.owner, binding: { ...first.binding, snapshotSha256: "b".repeat(64) }, generation: 0 },
      { owner: fixture.owner, binding: first.binding, generation: 1 },
    ];
    for (const variant of variants) expect(await repositoryConversation(fixture.store,
      variant.owner, variant.binding, variant.generation, "New question"))
      .toEqual([{ kind: "question", text: "New question" }]);
  } finally { await fixture.close(); }
});

test("context drops oversized complete exchanges without rewriting existing data or paying for compaction", async () => {
  const fixture = await repositoryAgentFixture();
  try {
    let first = await fixture.start(); fixture.answer("First answer");
    first = await fixture.service.advance(fixture.owner, first.id, new AbortController().signal);
    const large = { ...first, messages: [{ kind: "question" as const, text: "x".repeat(100_000) }], version: first.version + 1 };
    await fixture.store.save(large, first.version);
    expect(await repositoryConversation(fixture.store, fixture.owner, first.binding, 0, "Next"))
      .toEqual([{ kind: "question", text: "Next" }]);
    expect((await fixture.store.find(fixture.owner, first.id))?.messages).toEqual(large.messages);
    expect(fixture.requests).toHaveLength(1);
  } finally { await fixture.close(); }
});
