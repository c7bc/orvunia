import type { AgentJob, AgentTurn } from "./domain.ts";
import type { AgentDependencies } from "./ports.ts";
import { saveAgentJob } from "./persistence.ts";
import { agentAssert, agentLimits, encodedBytes } from "./limits.ts";
import { validateTool } from "./tools.ts";
import { checkpointAgentJob } from "./checkpoint.ts";
import { remainingRepositoryTools } from "./progress.ts";
import { ProviderError } from "../providers/domain.ts";

export async function runAgentTurn(dependencies: AgentDependencies, initial: AgentJob, signal: AbortSignal,
  onText?: (delta: string) => void) {
  const { store, clock, accounting, usage } = dependencies;
  agentAssert(initial.turns < agentLimits.turns && initial.tools <= agentLimits.tools, "repository_agent_limit", 422);
  agentAssert(encodedBytes(initial.messages) <= agentLimits.contextBytes, "repository_agent_limit", 413);
  agentAssert(initial.inputTokens + initial.outputTokens < agentLimits.totalTokens, "repository_agent_limit", 422);
  agentAssert(await dependencies.authorized(initial.owner), "unauthorized", 401);
  await dependencies.validateSources(initial.owner, initial.sourceTranscriptIds, initial.historyGeneration);
  const model = await dependencies.model(initial.owner);
  agentAssert(model.fingerprint === initial.providerFingerprint, "repository_provider_changed");
  signal.throwIfAborted();
  let job = await saveAgentJob(store, initial, { status: "invoking", reservationId: null }, clock());
  let reservation: Awaited<ReturnType<typeof accounting.reserve>>;
  try {
    reservation = await accounting.reserve(initial.owner.workspaceId, "answers", 1, `repository-agent:${initial.id}:${initial.turns + 1}`);
  } catch (error) {
    await checkpointAgentJob(store, job, { status: "failed", error: "repository_admission_failed" }, clock);
    throw error;
  }
  try {
    job = await checkpointAgentJob(store, job, { reservationId: reservation.id }, clock);
    if (job.status !== "invoking" || job.cancelRequested || signal.aborted) {
      await accounting.release(initial.owner.workspaceId, reservation.id, true);
      return checkpointAgentJob(store, job, { status: "cancelled", error: "repository_agent_cancelled" }, clock);
    }
  } catch (error) { await accounting.release(initial.owner.workspaceId, reservation.id, true); throw error; }
  let result: AgentTurn;
  const toolsRemaining = remainingRepositoryTools(job);
  try {
    signal.throwIfAborted();
    result = await model.turn(job.messages, agentLimits.outputTokens, signal, toolsRemaining, delta => {
      signal.throwIfAborted(); onText?.(delta);
    });
  } catch (error) {
    job = (await store.find(job.owner, job.id)) ?? job;
    await accounting.unknown(job.owner.workspaceId, reservation.id);
    await usage.record(job.owner, { jobId: job.id, turn: job.turns + 1, reservationId: reservation.id,
      state: "unknown", model: null, inputTokens: null, outputTokens: null,
      cachedInputTokens: null, reasoningTokens: null });
    await checkpointAgentJob(store, job, { status: "unknown", error: error instanceof ProviderError
      && error.code === "provider_limit" ? "repository_provider_limit" : "repository_invocation_unknown" }, clock);
    throw error;
  }
  job = (await store.find(job.owner, job.id)) ?? job;
  await usage.record(job.owner, { jobId: job.id, turn: job.turns + 1, reservationId: reservation.id,
    state: "known", model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    cachedInputTokens: result.cachedInputTokens, reasoningTokens: result.reasoningTokens });
  if (reservation.state !== "committed") await accounting.commit(job.owner.workspaceId, reservation.id, 1, { model: result.model,
    inputTokens: result.inputTokens, outputTokens: result.outputTokens, priceVersion: null, source: "provider" });
  job = (await store.find(job.owner, job.id)) ?? job;
  if (signal.aborted || job.cancelRequested || !await dependencies.authorized(job.owner)) {
    return checkpointAgentJob(store, job, { status: "cancelled", error: "repository_agent_cancelled" }, clock);
  }
  if (result.failure) return checkpointAgentJob(store, job, { status: "failed", error: result.failure }, clock);
  try {
    agentAssert(result.calls.length <= toolsRemaining, "repository_agent_limit", 422);
    agentAssert(job.turns + 1 < agentLimits.turns || result.calls.length === 0, "repository_agent_limit", 422);
    agentAssert(new Set(result.calls.map((call) => call.callId)).size === result.calls.length,
      "repository_tool_invalid", 422);
    agentAssert(result.calls.every((call) => !job.pending.some((previous) => previous.callId === call.callId)),
      "repository_tool_invalid", 422);
    for (const call of result.calls) validateTool(call);
  } catch (error) {
    await checkpointAgentJob(store, job, { status: "failed", error: "repository_tool_invalid" }, clock);
    throw error;
  }
  const next = await checkpointAgentJob(store, job, {
    turns: job.turns + 1, tools: job.tools + result.calls.length,
    inputTokens: job.inputTokens + result.inputTokens, outputTokens: job.outputTokens + result.outputTokens,
    messages: [...job.messages, { kind: "provider", output: result.output }],
    pending: [...job.pending, ...result.calls.map((call) => ({ ...call, token: dependencies.identifier() }))],
    status: result.calls.length ? "waiting_tools" : "completed", answer: result.calls.length ? null : result.text,
    reservationId: null,
  }, clock);
  if (next.status === "completed") await dependencies.complete(next);
  return next;
}
