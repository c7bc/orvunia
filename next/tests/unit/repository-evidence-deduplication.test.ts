import { expect, test } from "bun:test";
import { deduplicateRepositoryEvidence } from "../../packages/repository-agent/evidence-deduplication.ts";
import type { AgentMessage, Json } from "../../packages/repository-agent/domain.ts";

function invocation(id: string, output: string, name = "repository_read"): AgentMessage[] {
  return [{ kind: "provider", output: [{ type: "function_call", call_id: id, name, arguments: "{}" }] },
    { kind: "tool", callId: id, output }];
}
test("duplicate evidence removes complete call/result pairs while preserving all conversational text", () => {
  const messages: AgentMessage[] = [{ kind: "question", text: "First" }, ...invocation("a", "same read"),
    { kind: "provider", output: [{ type: "message", content: "First answer" }] },
    { kind: "question", text: "Second" }, ...invocation("b", "same read"),
    { kind: "provider", output: [{ type: "message", content: "Second answer" }] },
    { kind: "question", text: "Third" }];
  const before = structuredClone(messages), result = deduplicateRepositoryEvidence(messages);
  expect(result).toEqual([...messages.slice(0, 5), ...messages.slice(7)]);
  expect(messages).toEqual(before);
  expect(JSON.stringify(result)).not.toContain('"call_id":"b"');
  expect(result.filter(message => message.kind === "tool")).toHaveLength(1);
  expect(deduplicateRepositoryEvidence(result)).toEqual(result);
});
test("distinct evidence, tool names, and incomplete calls remain intact", () => {
  const messages: AgentMessage[] = [...invocation("a", "old source"), ...invocation("b", "new source"),
    ...invocation("c", "old source", "repository_search"),
    { kind: "provider", output: [{ type: "function_call", call_id: "pending", name: "repository_read" }] }];
  expect(deduplicateRepositoryEvidence(messages)).toEqual(messages);
});
test("mixed provider output retains its message and unique call when one repeated call is removed", () => {
  const extra: Json = { type: "function_call", call_id: "unique", name: "repository_read" };
  const messages: AgentMessage[] = [...invocation("first", "same"),
    { kind: "provider", output: [{ type: "message", content: "Explanation" },
      { type: "function_call", call_id: "duplicate", name: "repository_read" }, extra] },
    { kind: "tool", callId: "duplicate", output: "same" }, { kind: "tool", callId: "unique", output: "other" }];
  expect(deduplicateRepositoryEvidence(messages).slice(2)).toEqual([
    { kind: "provider", output: [{ type: "message", content: "Explanation" }, extra] },
    { kind: "tool", callId: "unique", output: "other" }]);
});
