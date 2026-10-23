import type { AgentJob } from "./domain.ts";
import type { AgentDependencies } from "./ports.ts";
import { runAgentTurn } from "./runner.ts";

export async function executeAgentTurn(dependencies: AgentDependencies, job: AgentJob,
  controller: AbortController, signal: AbortSignal, onText?: (delta: string) => void) {
  const lease = await dependencies.admission?.enter();
  let renewing: Promise<unknown> = Promise.resolve();
  const interval = lease ? setInterval(() => {
    renewing = lease.renew().then((valid) => { if (!valid) controller.abort(); }, () => controller.abort());
  }, 30_000) : undefined;
  interval?.unref();
  try { return await runAgentTurn(dependencies, job, signal, onText); }
  finally { clearInterval(interval); await renewing; await lease?.release(); }
}
