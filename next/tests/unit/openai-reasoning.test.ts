import { expect, test } from "bun:test";
import { openaiReasoning } from "../../packages/providers/openai-reasoning.ts";
import { generation } from "../../packages/providers/generation.ts";
import { providerStream } from "../support/provider-stream.ts";

test("requested Sol version uses supported low effort without changing Luna's latency setting", () => {
  for (const model of ["gpt-6.1-sol", "gpt-6.1-sol-2026-10-01", "gpt-6-astra"])
    expect(openaiReasoning(model)).toEqual({ reasoning: { effort: "low" } });
  for (const model of ["gpt-6-luna", "gpt-6-sol"])
    expect(openaiReasoning(model)).toEqual({ reasoning: { effort: "none" } });
  for (const model of ["local", "gpt-6.1-solitude", "gpt-5.6-luna", "future-model"])
    expect(openaiReasoning(model)).toEqual({});
});

test("Sol normal answer sends low effort and delivers deltas before completion", async () => {
  let dispatched = 0;
  const deltas: string[] = [];
  const provider = generation({ provider: "openai", model: "gpt-6.1-sol", apiKey: "synthetic",
    baseUrl: "https://api.openai.com/v1", vision: true, maxTokens: 900 }, async (_url, options) => {
    const body = JSON.parse(String(options?.body)); dispatched++;
    expect(body.model).toBe("gpt-6.1-sol");
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.stream).toBe(true); expect(body.store).toBe(false);
    return providerStream([{ type: "response.output_text.delta", delta: "I would " },
      { type: "response.output_text.delta", delta: "check the data." },
      { type: "response.completed", response: { usage: { input_tokens: 10, output_tokens: 6 } } }]);
  });
  const answer = await provider.answer({ instructions: "Synthetic", context: "Synthetic", images: [] },
    new AbortController().signal, text => deltas.push(text));
  expect(dispatched).toBe(1); expect(deltas).toEqual(["I would ", "check the data."]);
  expect(answer.model).toBe("gpt-6.1-sol");
});
