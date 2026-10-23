import { repositoryContainsSensitiveText } from "../repository-context/sensitive.ts";
import { toolArguments, toolResults, type ToolName } from "./contracts.ts";
import type { AgentJob, PendingTool, ToolCall } from "./domain.ts";
import { agentAssert, agentLimits, encodedBytes } from "./limits.ts";
import { evaluateAgentPermission, repositoryPermissions } from "../agent-engine/permissions.ts";

export function validateTool(call: ToolCall) {
  agentAssert(evaluateAgentPermission(call.name, "snapshot", repositoryPermissions).effect === "allow",
    "repository_tool_unsupported", 422);
  agentAssert(Object.hasOwn(toolArguments, call.name), "repository_tool_unsupported", 422);
  agentAssert(call.callId.length > 0 && call.callId.length <= 128 && call.arguments.length <= 4_096,
    "repository_tool_invalid", 422);
  const schema = toolArguments[call.name as ToolName];
  let input: unknown;
  try { input = JSON.parse(call.arguments); } catch { agentAssert(false, "repository_tool_invalid", 422); }
  const parsed = schema.safeParse(input);
  agentAssert(parsed.success, "repository_tool_invalid", 422);
  return parsed.data;
}

export function validatedResult(job: AgentJob, pending: PendingTool, value: unknown) {
  const parsed = toolResults[pending.name as ToolName].safeParse(value);
  agentAssert(parsed.success, "repository_result_invalid", 422);
  const result = parsed.data;
  agentAssert(result.grantId === job.binding.grantId && result.revision === job.binding.revision
    && result.snapshotSha256 === job.binding.snapshotSha256, "repository_revision_changed");
  if ("error" in result) {
    agentAssert(result.error.tool === pending.name && (pending.name === "repository_read"
      || result.error.code === "repository_file_not_found"), "repository_result_invalid", 422);
  } else if (pending.name === "repository_read") {
    const args = validateTool(pending) as { path: string; fromLine: number; toLine: number };
    const read = result as { path: string; fromLine: number; toLine: number; text: string };
    agentAssert(read.path === args.path && read.fromLine === args.fromLine
      && read.toLine >= args.fromLine && read.toLine <= args.toLine,
      "repository_result_invalid", 422);
    agentAssert(read.text.split(/\r?\n/).length === read.toLine - read.fromLine + 1,
      "repository_result_invalid", 422);
  }
  if (!("error" in result) && pending.name === "repository_search") {
    const args = validateTool(pending) as { query: string; path: string | null };
    const search = result as { query: string; matches: { path: string }[] };
    agentAssert(search.query === args.query && (!args.path || search.matches.every((match) => match.path === args.path)),
      "repository_result_invalid", 422);
  }
  const text = JSON.stringify(result);
  agentAssert(!repositoryContainsSensitiveText(text), "repository_sensitive_result", 422);
  agentAssert(pending.result !== undefined || job.bytes + encodedBytes(result) <= agentLimits.bytes,
    "repository_agent_limit", 413);
  return text;
}
