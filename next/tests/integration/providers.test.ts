import { expect, test } from "bun:test";
import { generation } from "../../packages/providers/generation.ts";
import type { ResponseConnection } from "../../packages/providers/domain.ts";
import { providerStream } from "../support/provider-stream.ts";
import { boundedFetch } from "../../packages/providers/http.ts";

const connection: ResponseConnection = {
  provider: "openai",
  model: "gpt-6-luna",
  apiKey: "synthetic-private-key",
  baseUrl: "https://api.openai.com/v1",
  vision: true,
  maxTokens: 3000,
};
const input = {
  instructions: "Independent test instructions",
  context: "Synthetic context",
  images: [],
};

test("OpenAI Responses preserves UTF-8 deltas, disabled storage and measured token usage", async () => {
  const seen: string[] = [];
  const provider = generation(connection, async (url, options) => {
    expect(String(url)).toBe("https://api.openai.com/v1/responses");
    expect(options?.redirect).toBe("error");
    const payload = JSON.parse(String(options?.body));
    expect(payload.model).toBe("gpt-6-luna");
    expect(payload.store).toBe(false);
    expect(payload.max_output_tokens).toBe(3000);
    return providerStream(
      [
        { type: "response.output_text.delta", delta: "Olá " },
        { type: "response.output_text.delta", delta: "mundo" },
        {
          type: "response.completed",
          response: { usage: { input_tokens: 20, output_tokens: 5 } },
        },
      ],
      1,
    );
  });
  const result = await provider.answer(
    input,
    new AbortController().signal,
    (text) => seen.push(text),
  );
  expect(result.text).toBe("Olá mundo");
  expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 5 });
  expect(seen).toEqual(["Olá ", "mundo"]);
});

test("provider errors remain sanitized, incomplete output fails and requests are never automatically repeated", async () => {
  let calls = 0;
  const failed = generation(connection, async () => {
    calls++;
    return Response.json(
      {
        error: {
          message: "private credential details",
          type: "invalid_request_error",
        },
      },
      { status: 401 },
    );
  });
  await expect(
    failed.answer(input, new AbortController().signal, () => {}),
  ).rejects.toMatchObject({ code: "provider_auth" });
  expect(calls).toBe(1);
  const incomplete = generation(connection, async () =>
    providerStream([
      { type: "response.output_text.delta", delta: "Partial" },
      { type: "response.incomplete" },
    ]),
  );
  await expect(
    incomplete.answer(input, new AbortController().signal, () => {}),
  ).rejects.toMatchObject({ code: "provider_incomplete" });
  const noVision = generation({ ...connection, vision: false }, async () => {
    throw Error("Must not send images");
  });
  await expect(
    noVision.answer(
      { ...input, images: [{ mime: "image/png", data: new Uint8Array([1]) }] },
      new AbortController().signal,
      () => {},
    ),
  ).rejects.toMatchObject({ code: "vision_disabled" });
});

test("compatible generation serves Gemini, Groq, OpenRouter, Ollama and custom endpoints", async () => {
  for (const name of [
    "gemini",
    "groq",
    "openrouter",
    "ollama",
    "compatible",
  ] as const) {
    const provider = generation(
      { ...connection, provider: name, model: "synthetic-model" },
      async (url, options) => {
        expect(String(url)).toEndWith("/chat/completions");
        expect(
          JSON.parse(String(options?.body)).stream_options.include_usage,
        ).toBe(true);
        return providerStream([
          { choices: [{ delta: { content: "Answer" }, finish_reason: null }] },
          {
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
          },
          "[DONE]",
        ]);
      },
    );
    const result = await provider.answer(
      input,
      new AbortController().signal,
      () => {},
    );
    expect(result.text).toBe("Answer");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 2 });
  }
});

test("Anthropic adapter requires completion and propagates usage and text deltas", async () => {
  const provider = generation(
    { ...connection, provider: "anthropic" },
    async (url, options) => {
      expect(String(url)).toEndWith("/messages");
      expect(new Headers(options?.headers).get("x-api-key")).toBe(
        connection.apiKey ?? "",
      );
      return providerStream([
        { type: "message_start", message: { usage: { input_tokens: 13 } } },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Resposta" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 4 },
        },
        { type: "message_stop" },
      ]);
    },
  );
  const result = await provider.answer(
    input,
    new AbortController().signal,
    () => {},
  );
  expect(result.text).toBe("Resposta");
  expect(result.usage).toEqual({ inputTokens: 13, outputTokens: 4 });
});

test("provider transport bounds JSON and SSE frames before SDK parsing", async () => {
  const json = boundedFetch(
    async () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
  );
  await expect(
    (await json("https://example.test")).text(),
  ).rejects.toMatchObject({ code: "provider_unavailable" });
  const stream = boundedFetch(async () =>
    providerStream([{ delta: "x".repeat(512 * 1024) }], 65536),
  );
  await expect(
    (await stream("https://example.test")).text(),
  ).rejects.toMatchObject({ code: "provider_unavailable" });
});
