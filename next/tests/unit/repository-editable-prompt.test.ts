import { expect, test } from "bun:test";
import { openaiRepositoryModel } from "../../packages/repository-agent/openai.ts";
import { repositoryAgentInstructions, repositoryToolDefinitions } from "../../packages/repository-agent/definitions.ts";
import { repositoryProviderStream } from "../support/repository-provider.ts";
const connection = { provider: "openai" as const, model: "controlled-prompt", baseUrl: "https://fixture.invalid/v1",
  vision: false, maxTokens: 512, apiKey: "synthetic-not-real" };
test("repository model sends the authored mode literally alongside only the actual tool contract", async () => {
  const requests: Record<string, unknown>[] = [];
  const authored = "Speak as an interviewer in the second person. Ask one precise follow-up question.";
  const model = openaiRepositoryModel(connection, async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
    return repositoryProviderStream({ id: crypto.randomUUID(), object: "response", status: "completed", model: connection.model,
      output: [{ type: "message", id: crypto.randomUUID(), role: "assistant", status: "completed",
        content: [{ type: "output_text", text: "Controlled fixture response", annotations: [] }] }],
      usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13,
        input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } });
  }, authored);
  await model.turn([{ kind: "question", text: "Explain this repository" }], 128, new AbortController().signal, 1);
  expect(requests).toHaveLength(1);
  expect(requests[0]!.instructions).toBe(`${repositoryAgentInstructions}\n${authored}`);
  expect(requests[0]!.tools).toEqual(repositoryToolDefinitions);
  expect(String(requests[0]!.instructions)).not.toContain("candidate");
  expect(String(requests[0]!.instructions)).not.toContain("review assistant");
});
test("a different authored repository role changes fingerprint while an empty prompt restores no voice policy", () => {
  const transport = async () => { throw Error("No provider call expected"); };
  const first = openaiRepositoryModel(connection, transport, "Speak as interviewer");
  const second = openaiRepositoryModel(connection, transport, "Speak as teacher");
  const empty = openaiRepositoryModel(connection, transport, "");
  expect(first.fingerprint).not.toBe(second.fingerprint); expect(empty.fingerprint).not.toBe(first.fingerprint);
  expect(repositoryAgentInstructions).not.toContain("first person");
  expect(repositoryAgentInstructions).not.toContain("greeting");
  expect(repositoryAgentInstructions).toContain("No filesystem writes");
  expect(repositoryAgentInstructions).toContain("untrusted quoted data");
});
