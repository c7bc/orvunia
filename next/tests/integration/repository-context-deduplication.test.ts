import { expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";

test("repeated reads do not accumulate in later model context or rewrite saved exchanges", async () => {
  const fixture = await repositoryAgentFixture();
  const signal = new AbortController().signal;
  const binding = { grantId: fixture.preview.grantId, revision: fixture.preview.revision,
    snapshotSha256: fixture.preview.snapshotSha256 };
  try {
    let last;
    for (const question of ["First explanation", "Second explanation"]) {
      let job = await fixture.service.start(fixture.owner, { requestId: crypto.randomUUID(), consent: true,
        question, binding });
      fixture.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 });
      job = await fixture.service.advance(fixture.owner, job.id, signal);
      const call = job.pending.find(item => item.result === undefined)!;
      await fixture.service.reply(fixture.owner, job.id, { callId: call.callId, token: call.token,
        result: fixture.context.read(fixture.nativeOwner, fixture.preview,
          { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 }) });
      fixture.answer(question + " answer");
      last = await fixture.service.advance(fixture.owner, job.id, signal);
      fixture.advance(1);
    }
    const saved = structuredClone(last!);
    const third = await fixture.service.start(fixture.owner, { requestId: crypto.randomUUID(), consent: true,
      question: "Third explanation", binding });
    expect(third.messages.filter(item => item.kind === "tool")).toHaveLength(1);
    expect(third.messages.filter(item => item.kind === "question").map(item => item.text))
      .toEqual(["First explanation", "Second explanation", "Third explanation"]);
    expect(await fixture.store.find(fixture.owner, saved.id)).toEqual(saved);
    expect(saved.messages.filter(item => item.kind === "tool")).toHaveLength(2);
    expect((await fixture.sessions.counts(fixture.owner.workspaceId, fixture.owner.sessionId)).responses).toBe(2);
  } finally { await fixture.close(); }
});
