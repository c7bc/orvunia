import { createHash } from "node:crypto";
import { startSchema, toolReplySchema } from "./contracts.ts";
import type { AgentJob, AgentOwner } from "./domain.ts";
import type { AgentDependencies } from "./ports.ts";
import { agentAssert, agentLimits, encodedBytes } from "./limits.ts";
import { requireAgentJob, saveAgentJob } from "./persistence.ts";
import { validatedResult } from "./tools.ts";
import { executeAgentTurn } from "./execution.ts";
import { repositoryConversation } from "./context.ts";

export function createRepositoryAgent(dependencies: AgentDependencies) {
  const active = new Map<string, { controller: AbortController; pending: Promise<AgentJob>; owner: AgentOwner }>();
  const { store, clock } = dependencies;
  let closed = false;
  async function get(owner: AgentOwner, id: string) {
    let job = await requireAgentJob(store, owner, id);
    if (job.status === "invoking" && !active.has(job.id)
      && clock() - job.updatedAt > agentLimits.callMilliseconds + 5_000) {
      if (job.reservationId) {
        await dependencies.accounting.unknown(owner.workspaceId, job.reservationId);
        await dependencies.usage.record(owner, { jobId: job.id, turn: job.turns + 1,
          reservationId: job.reservationId, state: "unknown", model: null,
          inputTokens: null, outputTokens: null, cachedInputTokens: null, reasoningTokens: null });
      }
      job = await saveAgentJob(store, job, { status: "unknown", error: "repository_invocation_unknown" }, clock());
    }
    if (job.status === "completed") await dependencies.complete(job);
    return job;
  }
  return {
    get,
    async start(owner: AgentOwner, value: unknown) {
      agentAssert(!closed, "repository_agent_closed", 503);
      agentAssert(await dependencies.authorized(owner), "unauthorized", 401);
      const input = startSchema.parse(value);
      const now = clock();
      const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const receipt = await store.receipt(owner, input.requestId);
      if (receipt) {
        agentAssert(receipt.fingerprint === fingerprint, "repository_request_conflict");
        return receipt;
      }
      const historyGeneration = await dependencies.historyGeneration(owner);
      await dependencies.validateSources(owner, input.sourceTranscriptIds, historyGeneration);
      const model = await dependencies.model(owner);
      const messages = await repositoryConversation(store, owner, input.binding, historyGeneration, input.question);
      const job = await store.create({ id: dependencies.identifier(), owner, requestId: input.requestId,
        fingerprint, binding: input.binding, historyGeneration,
        ...(input.sourceTranscriptIds ? { sourceTranscriptIds: [...input.sourceTranscriptIds] } : {}),
        providerFingerprint: model.fingerprint,
        status: "ready", version: 0, turns: 0, tools: 0, bytes: 0, inputTokens: 0, outputTokens: 0,
        createdAt: now, updatedAt: now, messages,
        pending: [], answer: null, error: null, reservationId: null, cancelRequested: false });
      agentAssert(job.fingerprint === fingerprint, "repository_request_conflict");
      return job;
    },
    async advance(owner: AgentOwner, id: string, signal: AbortSignal, onText?: (delta: string) => void) {
      agentAssert(!closed, "repository_agent_closed", 503);
      const job = await get(owner, id);
      if (job.status !== "ready") return job;
      if (clock() - job.createdAt > agentLimits.lifetimeMilliseconds) {
        return saveAgentJob(store, job, { status: "failed", error: "repository_agent_expired" }, clock());
      }
      agentAssert(!active.has(id) && active.size < 4, "repository_agent_busy");
      const controller = new AbortController();
      const combined = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(agentLimits.callMilliseconds)]);
      const pending = executeAgentTurn(dependencies, job, controller, combined, onText);
      active.set(id, { controller, pending, owner });
      try { return await pending; } finally { active.delete(id); }
    },
    async reply(owner: AgentOwner, id: string, value: unknown) {
      const input = toolReplySchema.parse(value);
      const job = await get(owner, id);
      const pending = job.pending.find((call) => call.callId === input.callId && call.token === input.token);
      agentAssert(pending, "repository_tool_not_found", 404);
      const result = validatedResult(job, pending, input.result);
      if (pending.result !== undefined) {
        agentAssert(pending.result === result, "repository_result_conflict");
        return job;
      }
      agentAssert(job.status === "waiting_tools", "repository_agent_not_waiting");
      const next = job.pending.map((call) => call === pending ? { ...call, result } : call);
      const complete = next.every((call) => call.result !== undefined);
      return saveAgentJob(store, job, { pending: next, bytes: job.bytes + encodedBytes(JSON.parse(result)),
        status: complete ? "ready" : "waiting_tools",
        messages: complete ? [...job.messages, ...next.filter((call) => !job.messages.some((message) =>
          message.kind === "tool" && message.callId === call.callId)).map((call) => ({ kind: "tool" as const,
          callId: call.callId, output: call.result! }))] : job.messages }, clock());
    },
    async cancel(owner: AgentOwner, id: string) {
      const job = await get(owner, id);
      if (["completed", "cancelled", "unknown", "failed"].includes(job.status)) return job;
      const next = await saveAgentJob(store, job, { cancelRequested: true,
        ...(job.status !== "invoking" ? { status: "cancelled" as const } : {}) }, clock());
      const running = active.get(id);
      if (running) { running.controller.abort(); await running.pending.catch(() => {}); }
      return running ? get(owner, id) : next;
    },
    async close() {
      closed = true;
      for (const running of active.values()) running.controller.abort();
      await Promise.allSettled([...active.values()].map((running) => running.pending));
    },
    async invalidate(workspaceId: string, sessionId: string) {
      const matching = [...active.values()].filter((running) =>
        running.owner.workspaceId === workspaceId && running.owner.sessionId === sessionId);
      for (const running of matching) running.controller.abort();
      await Promise.allSettled(matching.map((running) => running.pending));
    },
  };
}
export type RepositoryAgent = ReturnType<typeof createRepositoryAgent>;
