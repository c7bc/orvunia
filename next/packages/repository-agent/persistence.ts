import type { AgentJob, AgentOwner, AgentStore } from "./domain.ts";
import { agentAssert } from "./limits.ts";

export async function requireAgentJob(store: AgentStore, owner: AgentOwner, id: string) {
  const job = await store.find(owner, id);
  agentAssert(job, "repository_agent_not_found", 404);
  return job;
}

export async function saveAgentJob(store: AgentStore, previous: AgentJob, changes: Partial<AgentJob>, now: number) {
  const next = { ...previous, ...changes, version: previous.version + 1, updatedAt: now };
  agentAssert(await store.save(next, previous.version), "repository_agent_busy");
  return next;
}
