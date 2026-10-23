import OpenAI from "openai";
import type { ResponseConnection } from "../providers/domain.ts";
import { boundedFetch, type HttpFetch } from "../providers/http.ts";
import type { AgentMessage, AgentModel, Json } from "./domain.ts";
import { repositoryAgentInstructions, repositoryToolDefinitions } from "./definitions.ts";
import { agentAssert, agentLimits, encodedBytes } from "./limits.ts";
import { repositoryModelFingerprint } from "./fingerprint.ts";
import { maximumStepsInstructions } from "../agent-engine/max-steps.ts";
import { repositoryResponseStream } from "./stream.ts";
import { repositoryModelEvidence } from "./evidence.ts";
import { ProviderError } from "../providers/domain.ts";
import { openaiReasoning } from "../providers/openai-reasoning.ts";

function responseInput(messages: AgentMessage[]): OpenAI.Responses.ResponseInputItem[] {
  return messages.flatMap((message): OpenAI.Responses.ResponseInputItem[] => {
    if (message.kind === "question") return [{ role: "user", content: message.text }];
    if (message.kind === "tool") return [{ type: "function_call_output", call_id: message.callId,
      output: repositoryModelEvidence(message.output) }];
    return message.output as unknown as OpenAI.Responses.ResponseInputItem[];
  });
}

export function openaiRepositoryModel(connection: ResponseConnection, transport: HttpFetch, presentation = ""): AgentModel {
  agentAssert(connection.provider === "openai", "repository_tool_provider_unsupported", 422);
  const client = new OpenAI({ apiKey: connection.apiKey || "local", baseURL: connection.baseUrl,
    timeout: agentLimits.callMilliseconds, maxRetries: 0, fetch: boundedFetch(transport) });
  return {
    fingerprint: repositoryModelFingerprint(connection, presentation),
    async turn(messages, maximumOutputTokens, signal, toolsRemaining, onText) {
      const stream = await client.responses.create({ model: connection.model,
        instructions: `${repositoryAgentInstructions}\n${presentation}${toolsRemaining ? "" : "\n" + maximumStepsInstructions}`,
        input: responseInput(messages),
        tools: repositoryToolDefinitions, parallel_tool_calls: false,
        tool_choice: toolsRemaining ? "auto" : "none",
        max_output_tokens: maximumOutputTokens, store: false, stream: true,
        ...openaiReasoning(connection.model),
      }, { signal }).catch((error: unknown) => {
        if (error instanceof OpenAI.APIError && error.status === 429) throw new ProviderError("provider_limit", 429);
        throw error;
      });
      const response = await repositoryResponseStream(stream, signal, onText);
      const calls = response.output.flatMap((item) => item.type === "function_call"
        ? [{ callId: item.call_id, name: item.name, arguments: item.arguments }] : []);
      const text = response.output.flatMap((item) => item.type === "message"
        ? item.content.flatMap((content) => content.type === "output_text" ? [content.text] : []) : []).join("\n");
      agentAssert(response.usage, "repository_provider_usage_missing", 502);
      const failure = response.status !== "completed" ? "repository_provider_incomplete"
        : encodedBytes(response.output) > agentLimits.responseBytes ? "repository_response_limit"
          : !calls.length && !text.trim() ? "repository_provider_empty" : undefined;
      return { output: failure ? [] : response.output as unknown as Json[], calls: failure ? [] : calls,
        text: failure ? "" : text, model: response.model, ...(failure ? { failure } : {}),
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        cachedInputTokens: response.usage.input_tokens_details.cached_tokens,
        reasoningTokens: response.usage.output_tokens_details.reasoning_tokens };
    },
  };
}
