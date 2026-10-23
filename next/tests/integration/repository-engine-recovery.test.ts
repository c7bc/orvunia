import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";

test("missing repository path becomes a bounded tool error and the model corrects its read", async () => {
  const fixture = await repositoryAgentFixture();
  try {
    let job = await fixture.start();
    fixture.tool("repository_read", { path: "src/missing.ts", fromLine: 1, toLine: 10 });
    job = await fixture.service.advance(fixture.owner, job.id, new AbortController().signal);
    const pending = job.pending[0]!;
    job = await fixture.service.reply(fixture.owner, job.id, { callId: pending.callId, token: pending.token,
      result: { ...job.binding, error: { tool: "repository_read", code: "repository_file_not_found" } } });
    fixture.tool("repository_read", { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 });
    job = await fixture.service.advance(fixture.owner, job.id, new AbortController().signal);
    const fixed = job.pending.at(-1)!;
    const result = fixture.context.read(fixture.nativeOwner, fixture.preview,
      { path: "src/application/inventory.ts", fromLine: 1, toLine: 20 });
    await fixture.service.reply(fixture.owner, job.id, { callId: fixed.callId, token: fixed.token, result });
    fixture.answer("Corrected using src/application/inventory.ts:1-20.");
    job = await fixture.service.advance(fixture.owner, job.id, new AbortController().signal);
    expect(job.status).toBe("completed"); expect(fixture.requests).toHaveLength(3);
    expect(JSON.stringify(fixture.requests[1])).toContain("repository_file_not_found");
    await expect(fixture.service.reply(fixture.owner, job.id, { callId: pending.callId, token: pending.token,
      result: { ...job.binding, error: { tool: "repository_read", code: "repository_consent_required" } } }))
      .rejects.toMatchObject({ code: "repository_result_invalid" });
  } finally { await fixture.close(); }
});

test("repeated identical evidence forces a text conclusion instead of another tool loop", async () => {
  const fixture = await repositoryAgentFixture();
  try {
    let job = await fixture.start();
    for (let index = 0; index < 2; index++) {
      fixture.tool("repository_list", {});
      job = await fixture.service.advance(fixture.owner, job.id, new AbortController().signal);
      const pending = job.pending.at(-1)!;
      job = await fixture.service.reply(fixture.owner, job.id, { callId: pending.callId, token: pending.token,
        result: fixture.context.list(fixture.nativeOwner, fixture.preview) });
    }
    fixture.answer("Available files have been listed; implementation still requires inspection.");
    job = await fixture.service.advance(fixture.owner, job.id, new AbortController().signal);
    expect(job.status).toBe("completed");
    expect(fixture.requests.at(-1)?.tool_choice).toBe("none");
    expect(fixture.requests.at(-1)?.instructions).toContain("without more tool calls");
  } finally { await fixture.close(); }
});

test("native tool errors recover only after identity and consent checks; revoked grants stay fatal", async () => {
  const identity = { workspaceId: "engine", actorId: "actor", sessionId: crypto.randomUUID() };
  const handler = createNativeRepositoryHandler({ interactive() {}, activeSession: () => identity.sessionId,
    signal: new AbortController().signal, binding: async () => identity,
    choose: async () => ({ canceled: false, filePaths: [resolve(import.meta.dir, "../fixtures/repository")] }) });
  try {
    const selected = await handler.invoke("proof", { ...identity, action: "select", scope: ["src"] });
    const preview = selected as { grantId: string; revision: number; snapshotSha256: string };
    const binding = { grantId: preview.grantId, revision: preview.revision, snapshotSha256: preview.snapshotSha256 };
    const read = { ...identity, ...binding, action: "read", path: "src/missing.ts", fromLine: 1, toLine: 5 };
    await expect(handler.invoke("proof", read)).rejects.toThrow("repository_consent_required");
    await handler.invoke("proof", { ...identity, ...binding, action: "approve", consent: true });
    expect(await handler.invoke("proof", read)).toEqual({ ...binding,
      error: { tool: "repository_read", code: "repository_file_not_found" } });
    await handler.invoke("proof", { ...identity, ...binding, action: "revoke" });
    await expect(handler.invoke("proof", read)).rejects.toThrow();
  } finally { handler.close(); }
});
