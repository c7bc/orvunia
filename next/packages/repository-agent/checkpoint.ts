import type { AgentJob, AgentStore } from "./domain.ts";
import { agentAssert } from "./limits.ts";

export async function checkpointAgentJob(store: AgentStore, original: AgentJob,
  changes: Partial<AgentJob>, now: () => number) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.find(original.owner, original.id);
    agentAssert(current, "repository_agent_not_found", 404);
    if (current.status !== "invoking") return current;
    const cancel = current.cancelRequested && changes.status !== "unknown";
    const next: AgentJob = { ...current, ...changes, version: current.version + 1, updatedAt: now(),
      ...(cancel ? { status: "cancelled", answer: null, error: "repository_agent_cancelled" } : {}) };
    if (await store.save(next, current.version)) return next;
  }
  agentAssert(false, "repository_agent_busy");
}
