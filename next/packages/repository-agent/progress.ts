import type { AgentJob, PendingTool } from "./domain.ts";
import { agentLimits } from "./limits.ts";
import { validateTool } from "./tools.ts";

function signature(call: PendingTool) {
  return JSON.stringify([call.name, validateTool(call), call.result]);
}

export function remainingRepositoryTools(job: AgentJob) {
  if (job.turns + 1 >= agentLimits.turns) return 0;
  const settled = job.pending.filter((call) => call.result !== undefined);
  const last = settled.at(-1);
  // Two identical calls with identical results cannot produce new repository evidence.
  if (last && settled.slice(0, -1).some((call) => signature(call) === signature(last))) return 0;
  return Math.max(0, agentLimits.tools - job.tools);
}
