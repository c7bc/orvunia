import { expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { defaultRepositoryScope } from "../../../client/repository/scope.ts";

test("approved baseline and support tests can be read before the bounded final answer", async () => {
  const context = await repositoryAgentFixture(":memory:", [...defaultRepositoryScope]);
  const signal = new AbortController().signal;
  try {
    const listed = context.context.list(context.nativeOwner, context.preview);
    expect(JSON.stringify(listed)).toContain("tests/baseline/inventory.test.ts");
    expect(JSON.stringify(listed)).toContain("tests/support/fixture.ts");
    let job = await context.start();
    for (const path of ["src/application/inventory.ts", "src/infrastructure/memory.ts",
      "src/domain/validation.ts", "tests/baseline/inventory.test.ts", "tests/support/fixture.ts"]) {
      const source = context.preview.files.find(file => file.path === path)!;
      context.tool("repository_read", { path, fromLine: 1, toLine: source.lines });
      job = await context.service.advance(context.owner, job.id, signal);
      expect(job.status).toBe("waiting_tools");
      const call = job.pending.find(item => item.result === undefined)!;
      job = await context.service.reply(context.owner, job.id, { callId: call.callId, token: call.token,
        result: context.context.read(context.nativeOwner, context.preview, { path, fromLine: 1, toLine: source.lines }) });
    }
    context.answer("Eu validaria a reserva com o teste existente, sem alegar execução.");
    job = await context.service.advance(context.owner, job.id, signal);
    expect(job.status).toBe("completed");
    expect(context.requests[5]?.tool_choice).toBe("none");
    expect(JSON.stringify(context.requests[5]?.input)).toContain("replay idempotente");
    expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(1);
  } finally { await context.close(); }
});
