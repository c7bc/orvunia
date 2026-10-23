import { record } from "../legacy-web/validation.js";
import type { RepositoryBinding, RepositoryIdentity, RepositoryToolCall } from "./contracts.js";

export async function executeRepositoryTool(
  native: (value: unknown) => Promise<unknown>,
  identity: RepositoryIdentity,
  binding: RepositoryBinding,
  call: RepositoryToolCall,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (call.arguments.length > 2_000) throw Error("repository_tool_invalid");
  const argumentsValue = record(JSON.parse(call.arguments));
  const common = { ...identity, ...binding };
  let command: Record<string, unknown>;
  if (call.name === "repository_list") {
    if (Object.keys(argumentsValue).length) throw Error("repository_tool_invalid");
    command = { action: "list", ...common };
  } else if (call.name === "repository_search") {
    if (Object.keys(argumentsValue).some((key) => !["query", "path"].includes(key)))
      throw Error("repository_tool_invalid");
    command = { action: "search", ...common, query: argumentsValue.query,
      ...(argumentsValue.path === null || argumentsValue.path === undefined ? {} : { path: argumentsValue.path }) };
  } else if (call.name === "repository_read") {
    if (Object.keys(argumentsValue).some((key) => !["path", "fromLine", "toLine"].includes(key)))
      throw Error("repository_tool_invalid");
    command = { action: "read", ...common, path: argumentsValue.path,
      fromLine: argumentsValue.fromLine, toLine: argumentsValue.toLine };
  } else throw Error("repository_tool_invalid");
  const result = await native(command);
  signal.throwIfAborted();
  return result;
}
