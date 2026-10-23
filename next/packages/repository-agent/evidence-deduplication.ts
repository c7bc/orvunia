import type { AgentMessage, Json } from "./domain.ts";

function call(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.type !== "function_call" || typeof value.call_id !== "string" || typeof value.name !== "string") return null;
  return { id: value.call_id, name: value.name };
}

export function deduplicateRepositoryEvidence(messages: readonly AgentMessage[]): AgentMessage[] {
  const results = new Map(messages.flatMap(message => message.kind === "tool"
    ? [[message.callId, message.output] as const] : []));
  const seen = new Set<string>(), duplicateCalls = new Set<string>();
  const compacted: AgentMessage[] = [];
  for (const message of messages) {
    if (message.kind === "provider") {
      const output = message.output.filter(item => {
        const invocation = call(item);
        if (!invocation || !results.has(invocation.id)) return true;
        const key = JSON.stringify([invocation.name, results.get(invocation.id)]);
        if (!seen.has(key)) { seen.add(key); return true; }
        duplicateCalls.add(invocation.id); return false;
      });
      if (output.length) compacted.push({ kind: "provider", output });
    } else if (message.kind !== "tool" || !duplicateCalls.has(message.callId)) {
      compacted.push(message);
    }
  }
  return compacted;
}
