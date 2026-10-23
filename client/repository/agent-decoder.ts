import type { RepositoryAgentJob, RepositoryBinding, RepositoryToolCall } from "./contracts.js";
import { record } from "../legacy-web/validation.js";

export type RepositoryPendingTool = RepositoryToolCall & { callId: string; token: string };
export type RepositoryDecodedJob = RepositoryAgentJob & { pending: RepositoryPendingTool[]; binding: RepositoryBinding };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const integer = (value: unknown, maximum: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
function relativePath(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 240 && !value.includes("\\")
    && value.split("/").every((part) => part && part !== "." && part !== ".." && !/[\x00-\x1f\x7f:*?<>|]/.test(part));
}
function validateArguments(call: RepositoryPendingTool) {
  if (call.arguments.length > 4_096) throw Error("repository_tool_invalid");
  const value = record(JSON.parse(call.arguments));
  const keys = Object.keys(value).sort().join(",");
  if (call.name === "repository_list" && keys === "") return;
  if (call.name === "repository_search" && keys === "path,query" && typeof value.query === "string"
    && value.query.length >= 2 && value.query.length <= 128 && (value.path === null || relativePath(value.path))) return;
  if (call.name === "repository_read" && keys === "fromLine,path,toLine" && relativePath(value.path)
    && integer(value.fromLine, Number.MAX_SAFE_INTEGER) && Number(value.fromLine) >= 1
    && integer(value.toLine, Number.MAX_SAFE_INTEGER) && Number(value.toLine) >= Number(value.fromLine)
    && Number(value.toLine) - Number(value.fromLine) < 200) return;
  throw Error("repository_tool_invalid");
}

export function decodeRepositoryAgentJob(value: unknown, expected: RepositoryBinding, expectedId?: string): RepositoryDecodedJob {
  const job = record(value), binding = record(job.binding);
  if (Object.keys(job).sort().join(",") !== "answer,binding,cancelRequested,createdAt,error,id,pending,status,tools,turns,updatedAt"
    || Object.keys(binding).sort().join(",") !== "grantId,revision,snapshotSha256"
    || typeof job.id !== "string" || !uuid.test(job.id) || (expectedId && job.id !== expectedId)
    || !["ready", "invoking", "waiting_tools", "completed", "cancelled", "unknown", "failed"].includes(String(job.status))
    || binding.grantId !== expected.grantId || binding.revision !== expected.revision
    || binding.snapshotSha256 !== expected.snapshotSha256 || !Number.isSafeInteger(binding.revision)
    || Number(binding.revision) < 1 || typeof binding.snapshotSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(binding.snapshotSha256) || !Array.isArray(job.pending) || job.pending.length > 8
    || (job.answer !== null && (typeof job.answer !== "string" || job.answer.length > 131_072))
    || (job.error !== null && (typeof job.error !== "string" || job.error.length > 128))
    || !integer(job.turns, 6) || !integer(job.tools, 8) || typeof job.cancelRequested !== "boolean"
    || !integer(job.createdAt, Number.MAX_SAFE_INTEGER) || !integer(job.updatedAt, Number.MAX_SAFE_INTEGER)
    || Number(job.updatedAt) < Number(job.createdAt)
    || (job.status === "completed" ? typeof job.answer !== "string" || !job.answer.trim() : job.answer !== null))
    throw Error("repository_agent_invalid");
  const identities = new Set<string>();
  for (const item of job.pending) {
    const call = record(item);
    if (Object.keys(call).sort().join(",") !== "arguments,callId,name,token"
      || !["repository_list", "repository_search", "repository_read"].includes(String(call.name))
      || typeof call.callId !== "string" || !call.callId || call.callId.length > 128 || identities.has(call.callId)
      || typeof call.token !== "string" || !uuid.test(call.token) || typeof call.arguments !== "string")
      throw Error("repository_tool_invalid");
    identities.add(call.callId);
    validateArguments(call as unknown as RepositoryPendingTool);
  }
  if (job.status === "waiting_tools" ? !job.pending.length : job.pending.length !== 0)
    throw Error("repository_agent_invalid");
  return job as unknown as RepositoryDecodedJob;
}
