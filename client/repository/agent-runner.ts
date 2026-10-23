import type { RepositoryAgentJob, RepositoryBinding, RepositoryToolCall } from "./contracts.js";
import { decodeRepositoryAgentJob, type RepositoryDecodedJob as Job } from "./agent-decoder.js";
import { runAgentLoop, terminalAgentStates } from "../../next/packages/agent-engine/loop.js";

export function createRepositoryAgentRunner(ports: {
  request(path: string, options: RequestInit, signal: AbortSignal): Promise<unknown>;
  stream?(path: string, signal: AbortSignal): Promise<unknown>;
  execute(call: RepositoryToolCall, binding: RepositoryBinding, signal: AbortSignal): Promise<unknown>;
  onChange(job: RepositoryAgentJob): void;
}) {
  const base = (session: string) => `/sessions/${encodeURIComponent(session)}/repository-agent/jobs`;
  async function invoke(path: string, method: string, signal: AbortSignal, binding: RepositoryBinding,
    body?: unknown, expectedId?: string) {
    signal.throwIfAborted();
    const value = await ports.request(path, { method, signal,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }, signal);
    return decodeRepositoryAgentJob(value, binding, expectedId);
  }
  async function drive(sessionId: string, initial: Job, binding: RepositoryBinding, signal: AbortSignal) {
    if (initial.status === "invoking") { ports.onChange(initial); return initial; }
    let job = initial;
    const path = `${base(sessionId)}/${encodeURIComponent(job.id)}`;
    try {
      return await runAgentLoop(initial, {
        changed(value) { job = value; ports.onChange(value); },
        advance: async () => ports.stream
          ? decodeRepositoryAgentJob(await ports.stream(`${path}/advance/stream`, signal), binding, job.id)
          : invoke(`${path}/advance`, "POST", signal, binding, undefined, job.id),
        async executeTools(value) {
          let next = value;
          for (const call of value.pending) {
            signal.throwIfAborted();
            const result = await ports.execute(call, binding, signal);
            next = await invoke(`${path}/tools`, "POST", signal, binding,
              { callId: call.callId, token: call.token, result }, job.id);
          }
          return next;
        },
      }, signal, 12);
    } catch (error) {
      if (!terminalAgentStates.some((status) => status === job.status)) {
        const cleanup = AbortSignal.timeout(70_000);
        await ports.request(path, { method: "DELETE", signal: cleanup }, cleanup).catch(() => {});
      }
      throw error;
    }
  }
  return {
    async run(sessionId: string, question: string, binding: RepositoryBinding, signal: AbortSignal, sourceTranscriptIds?: readonly string[]) {
      const job = await invoke(base(sessionId), "POST", signal, binding,
        { requestId: crypto.randomUUID(), consent: true, question, binding,
          ...(sourceTranscriptIds ? { sourceTranscriptIds: [...sourceTranscriptIds] } : {}) });
      return drive(sessionId, job, binding, signal);
    },
    async resume(sessionId: string, jobId: string, binding: RepositoryBinding, signal: AbortSignal) {
      const job = await invoke(`${base(sessionId)}/${encodeURIComponent(jobId)}`, "GET", signal, binding, undefined, jobId);
      return drive(sessionId, job, binding, signal);
    },
    cancel(sessionId: string, jobId: string, signal = AbortSignal.timeout(70_000)) {
      return ports.request(`${base(sessionId)}/${encodeURIComponent(jobId)}`, { method: "DELETE", signal }, signal);
    },
  };
}
