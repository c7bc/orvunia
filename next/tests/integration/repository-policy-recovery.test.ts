import { expect, test } from "bun:test";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryModelFingerprint } from "../../packages/repository-agent/fingerprint.ts";
import { repositoryAgentInstructions, repositoryToolDefinitions } from "../../packages/repository-agent/definitions.ts";
import type { ResponseConnection } from "../../packages/providers/domain.ts";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";

const connection: ResponseConnection = { provider: "openai", model: "controlled-fixture", baseUrl: "https://fixture.invalid/v1",
  vision: false, maxTokens: 2048, apiKey: "synthetic-not-real" };

test("effective repository policy and tool schema are included in a stable versioned fingerprint", () => {
  const original = repositoryModelFingerprint(connection, "");
  expect(original).toBe(repositoryModelFingerprint({ ...connection, baseUrl: `${connection.baseUrl}/` }, ""));
  expect(original).toBe(repositoryModelFingerprint({ ...connection, apiKey: "other-secret" }, ""));
  expect(original).not.toBe(repositoryModelFingerprint(connection, "concise"));
  expect(original).not.toBe(repositoryModelFingerprint(connection, "", `${repositoryAgentInstructions}\nDifferent policy`));
  const tools = structuredClone(repositoryToolDefinitions);
  tools[0]!.description = "Changed tool contract";
  expect(original).not.toBe(repositoryModelFingerprint(connection, "", repositoryAgentInstructions, tools));
  const model = openaiRepositoryModel(connection, async () => { throw Error("No transport allowed"); });
  expect(model.fingerprint).toBe(original);
});

test("resuming a tool checkpoint under changed policy or tools is rejected before another inference or reservation", async () => {
  for (const mutation of ["policy", "tools"]) {
    const context = await repositoryAgentFixture();
    try {
      const job = await context.start(); context.tool("repository_list", {});
      const waiting = await context.service.advance(context.owner, job.id, new AbortController().signal);
      const call = waiting.pending[0]!;
      await context.service.reply(context.owner, job.id, { callId: call.callId, token: call.token,
        result: context.context.list(context.nativeOwner, context.preview) });
      const tools = structuredClone(repositoryToolDefinitions);
      if (mutation === "tools") tools[0]!.description = "New tool contract";
      const fingerprint = repositoryModelFingerprint(connection, "",
        mutation === "policy" ? `${repositoryAgentInstructions}\nNew policy` : repositoryAgentInstructions, tools);
      context.model({ fingerprint, async turn() { throw Error("Changed policy must not dispatch"); } });
      let reservations = 0;
      const reserve = context.dependencies.accounting.reserve;
      context.dependencies.accounting.reserve = async (...arguments_) => { reservations++; return reserve(...arguments_); };
      await expect(context.service.advance(context.owner, job.id, new AbortController().signal))
        .rejects.toMatchObject({ code: "repository_provider_changed" });
      expect(context.requests).toHaveLength(1);
      expect(reservations).toBe(0);
      expect((await context.store.find(context.owner, job.id))?.status).toBe("ready");
    } finally { await context.close(); }
  }
});

test("policy changes preserve terminal receipts and saved answers without inference or rewriting stored data", async () => {
  const context = await repositoryAgentFixture();
  try {
    const request = { requestId: crypto.randomUUID(), consent: true, question: "Explain the code", binding: {
      grantId: context.preview.grantId, revision: context.preview.revision, snapshotSha256: context.preview.snapshotSha256 } };
    const job = await context.service.start(context.owner, request); context.answer("Controlled terminal answer");
    await context.service.advance(context.owner, job.id, new AbortController().signal);
    const before = await context.store.find(context.owner, job.id);
    if (!before) throw Error("Completed fixture job is missing");
    const answer = await context.sessions.entry(context.owner.workspaceId, context.owner.sessionId, job.id, "responses");
    context.model({ fingerprint: repositoryModelFingerprint(connection, "", "Changed policy"),
      async turn() { throw Error("Terminal receipt must not dispatch"); } });
    expect(await context.service.get(context.owner, job.id)).toEqual(before);
    expect(await context.service.start(context.owner, request)).toEqual(before);
    expect(await context.sessions.entry(context.owner.workspaceId, context.owner.sessionId, job.id, "responses")).toEqual(answer);
    expect(context.requests).toHaveLength(1);
  } finally { await context.close(); }
});
