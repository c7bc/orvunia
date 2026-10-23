import { expect, test } from "bun:test";
import { decodeRepositoryAgentJob } from "../../../client/repository/agent-decoder.ts";
import { createRepositoryAgentRunner } from "../../../client/repository/agent-runner.ts";

const binding = { grantId: crypto.randomUUID(), revision: 1, snapshotSha256: "a".repeat(64) };
const job = () => ({ id: crypto.randomUUID(), status: "ready", answer: null, error: null,
  turns: 0, tools: 0, pending: [], binding, createdAt: 1, updatedAt: 1, cancelRequested: false });

test("renderer decoder rejects changed binding, malformed statuses, limits and unknown DTO fields", () => {
  const value = job();
  expect(decodeRepositoryAgentJob(value, binding).id).toBe(value.id);
  for (const changed of [
    { ...value, binding: { ...binding, revision: 2 } },
    { ...value, binding: { ...binding, grantId: crypto.randomUUID() } },
    { ...value, binding: { ...binding, snapshotSha256: "b".repeat(64) } },
    { ...value, status: "fake" }, { ...value, tools: 9 }, { ...value, turns: 7 },
    { ...value, id: "../bad" }, { ...value, answer: "Claimed success before completion" },
    { ...value, status: "completed", answer: null }, { ...value, model: "private-model" },
  ]) expect(() => decodeRepositoryAgentJob(changed, binding)).toThrow("repository_agent_invalid");
});

test("renderer decoder rejects traversal, duplicate calls, forged tokens and oversized read", () => {
  const value = { ...job(), status: "waiting_tools", turns: 1, tools: 1 };
  const call = { callId: "call-1", token: crypto.randomUUID(), name: "repository_read",
    arguments: JSON.stringify({ path: "src/code.ts", fromLine: 1, toLine: 20 }) };
  expect(decodeRepositoryAgentJob({ ...value, pending: [call] }, binding).pending).toHaveLength(1);
  for (const pending of [
    [call, call], [{ ...call, token: "not-token" }],
    [{ ...call, arguments: JSON.stringify({ path: "../.env", fromLine: 1, toLine: 1 }) }],
    [{ ...call, arguments: JSON.stringify({ path: "src/code.ts", fromLine: 1, toLine: 201 }) }],
    [{ ...call, name: "shell" }],
  ]) expect(() => decodeRepositoryAgentJob({ ...value, pending }, binding)).toThrow();
});

test("runner validates every response binding before executing tools and cancels safely", async () => {
  const initial = job();
  const requests: string[] = [];
  let executions = 0;
  const runner = createRepositoryAgentRunner({
    async request(path, options) {
      requests.push(`${options.method} ${path}`);
      if (options.method === "DELETE") return { ...initial, status: "cancelled" };
      if (path.endsWith("/advance")) return { ...initial, status: "waiting_tools", turns: 1, tools: 1,
        binding: { ...binding, revision: 2 }, pending: [{ callId: "call-1", token: crypto.randomUUID(),
          name: "repository_list", arguments: "{}" }] };
      return initial;
    },
    async execute() { executions++; return {}; }, onChange() {},
  });
  await expect(runner.run(crypto.randomUUID(), "Review", binding, new AbortController().signal))
    .rejects.toThrow("repository_agent_invalid");
  expect(executions).toBe(0);
  expect(requests.at(-1)).toStartWith("DELETE ");
});
