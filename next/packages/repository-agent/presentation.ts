import type { AgentJob } from "./domain.ts";
export function repositoryAgentView(job: AgentJob) {
  return { id: job.id, status: job.status, binding: job.binding, turns: job.turns, tools: job.tools,
    createdAt: job.createdAt, updatedAt: job.updatedAt, answer: job.answer, error: job.error,
    cancelRequested: job.cancelRequested,
    pending: job.status === "waiting_tools" ? job.pending.filter((call) => call.result === undefined)
      .map(({ callId, name, arguments: args, token }) => ({ callId, name, arguments: args, token })) : [] };
}
