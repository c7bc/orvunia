import { expect, test } from "bun:test";
import type { AgentJob, AgentOwner, AgentStore, AgentUsage, AgentUsageRecorder } from "../../packages/repository-agent/domain.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import { repositoryAgentHistory } from "../../packages/repository-agent/history.ts";

export type AgentPrivacyEnvironment = {
  owner: AgentOwner;
  sessions: SessionRepository;
  store: AgentStore;
  usage: AgentUsageRecorder;
  usageRows(owner: AgentOwner): Promise<AgentUsage[]>;
  financial(owner: AgentOwner, id: string): Promise<string | null>;
  seedFinancial(owner: AgentOwner, id: string): Promise<void>;
  purge(owner: AgentOwner): Promise<void>;
  close(): Promise<void>;
};

export function privateAgentJob(owner: AgentOwner, status: AgentJob["status"] = "completed"): AgentJob {
  return { id: crypto.randomUUID(), owner, historyGeneration: 0, providerFingerprint: "controlled-provider-fingerprint",
    requestId: crypto.randomUUID(), fingerprint: "controlled-request-fingerprint", binding: {
      grantId: crypto.randomUUID(), revision: 1, snapshotSha256: "a".repeat(64) },
    status, version: 0, turns: 1, tools: 1, bytes: 10, inputTokens: 100, outputTokens: 20,
    createdAt: 1, updatedAt: 2, messages: [{ kind: "question", text: "SYNTHETIC_PRIVATE_CODE" },
      { kind: "tool", callId: "controlled-read", output: "SYNTHETIC_PRIVATE_CODE" }],
    pending: [{ callId: "controlled-read", name: "repository_read", arguments: "SYNTHETIC_PRIVATE_CODE",
      token: crypto.randomUUID(), result: "SYNTHETIC_PRIVATE_CODE" }], answer: "SYNTHETIC_PRIVATE_CODE",
    error: null, reservationId: crypto.randomUUID(), cancelRequested: false };
}

export function privateAgentUsage(job: AgentJob, state: "known" | "unknown" = "unknown"): AgentUsage {
  return { jobId: job.id, turn: 1, reservationId: job.reservationId!, state,
    model: state === "known" ? "controlled-model" : null,
    inputTokens: state === "known" ? 100 : null, outputTokens: state === "known" ? 20 : null,
    cachedInputTokens: state === "known" ? 0 : null, reasoningTokens: state === "known" ? 0 : null };
}

function assertScrubbed(job: AgentJob | null, previous: AgentJob) {
  expect(job).not.toBeNull();
  expect(job!.messages).toEqual([]);
  expect(job!.pending).toEqual([]);
  expect(job!.answer).toBeNull();
  expect(JSON.stringify(job)).not.toContain("SYNTHETIC_PRIVATE_CODE");
  expect(job!.requestId).toBe(previous.requestId);
  expect(job!.reservationId).toBe(previous.reservationId);
  expect(job!.version).toBeGreaterThan(previous.version);
  expect(job!.cancelRequested).toBe(true);
}

export function repositoryAgentPrivacyCases(name: string, fixture: () => Promise<AgentPrivacyEnvironment>) {
  test(`${name}: clearing any history scrubs repository content but retains terminal receipts and cost metadata`, async () => {
    for (const clear of ["responses", "transcripts", "captures"] as const) {
      const context = await fixture();
      try {
        const job = await context.store.create(privateAgentJob(context.owner));
        await context.usage.record(context.owner, privateAgentUsage(job, "known"));
        await context.sessions.change(context.owner.workspaceId, context.owner.sessionId, (session) => ({
          next: { ...session, historyGeneration: session.historyGeneration + 1 }, clear }));
        const next = await context.store.find(context.owner, job.id);
        assertScrubbed(next, job);
        expect(next!.status).toBe("cancelled");
        expect(await context.store.receipt(context.owner, job.requestId)).toEqual(next);
        expect(await context.store.save({ ...job, version: 1 }, 0)).toBe(false);
        expect((await context.store.create({ ...job, id: crypto.randomUUID() })).id).toBe(job.id);
        await expect(repositoryAgentHistory(context.sessions)(job)).rejects.toMatchObject({ code: "history_changed" });
        expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
        expect(await context.usageRows(context.owner)).toEqual([privateAgentUsage(job, "known")]);
      } finally { await context.close(); }
    }
  });

  test(`${name}: ending a session preserves uncertain invocation accounting while revoking every old tool receipt`, async () => {
    const context = await fixture();
    try {
      const jobs = await Promise.all((["ready", "invoking", "waiting_tools", "completed", "unknown"] as const)
        .map((status) => context.store.create(privateAgentJob(context.owner, status))));
      await context.usage.record(context.owner, privateAgentUsage(jobs[1]!));
      await context.sessions.change(context.owner.workspaceId, context.owner.sessionId,
        (session) => ({ next: { ...session, state: "ended" } }));
      for (const previous of jobs) {
        const job = await context.store.find(context.owner, previous.id);
        assertScrubbed(job, previous);
        expect(job!.status).toBe(["invoking", "unknown"].includes(previous.status) ? "unknown" : "cancelled");
      }
      expect(await context.usageRows(context.owner)).toEqual([privateAgentUsage(jobs[1]!)]);
      await expect(repositoryAgentHistory(context.sessions)(jobs[3]!)).rejects.toBeDefined();
    } finally { await context.close(); }
  });

  test(`${name}: deleting one repository answer cannot resurrect it through an already-loaded completion callback`, async () => {
    const context = await fixture();
    try {
      const job = await context.store.create(privateAgentJob(context.owner));
      const complete = repositoryAgentHistory(context.sessions);
      await complete(job);
      expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(1);
      await context.sessions.change(context.owner.workspaceId, context.owner.sessionId,
        (session) => ({ next: session, remove: job.id }));
      await expect(complete(job)).rejects.toMatchObject({ code: "history_changed" });
      expect((await context.sessions.counts(context.owner.workspaceId, context.owner.sessionId)).responses).toBe(0);
      assertScrubbed(await context.store.find(context.owner, job.id), job);
    } finally { await context.close(); }
  });

  test(`${name}: session deletion is owner-scoped, removes repository jobs and keeps numeric unknown usage`, async () => {
    const context = await fixture();
    try {
      const job = await context.store.create(privateAgentJob(context.owner, "unknown"));
      await context.usage.record(context.owner, privateAgentUsage(job));
      expect(await context.sessions.remove(crypto.randomUUID(), context.owner.sessionId)).toBe(false);
      expect(await context.store.find(context.owner, job.id)).not.toBeNull();
      expect(await context.sessions.remove(context.owner.workspaceId, context.owner.sessionId)).toBe(true);
      expect(await context.store.find(context.owner, job.id)).toBeNull();
      await expect(context.store.create({ ...job, id: crypto.randomUUID() })).rejects.toBeDefined();
      expect(await context.usageRows(context.owner)).toEqual([privateAgentUsage(job)]);
    } finally { await context.close(); }
  });

  test(`${name}: account purge removes repository payloads and auxiliary usage without releasing uncertain financial reservations`, async () => {
    const context = await fixture();
    try {
      const job = await context.store.create(privateAgentJob(context.owner, "unknown"));
      await context.usage.record(context.owner, privateAgentUsage(job));
      await context.seedFinancial(context.owner, job.reservationId!);
      await context.purge(context.owner);
      expect(await context.store.find(context.owner, job.id)).toBeNull();
      expect(await context.usageRows(context.owner)).toEqual([]);
      await context.usage.record(context.owner, privateAgentUsage(job, "known"));
      expect(await context.usageRows(context.owner)).toEqual([]);
      expect(await context.financial(context.owner, job.reservationId!)).toBe("unknown");
    } finally { await context.close(); }
  });
}
