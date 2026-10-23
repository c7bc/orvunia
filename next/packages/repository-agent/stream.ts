import type OpenAI from "openai";
import type { Stream } from "openai/core/streaming";
import { agentAssert, agentLimits } from "./limits.ts";

export async function repositoryResponseStream(
  stream: Stream<OpenAI.Responses.ResponseStreamEvent>, signal: AbortSignal,
  onText?: (delta: string) => void,
) {
  let response: OpenAI.Responses.Response | undefined;
  let bytes = 0;
  try {
    for await (const event of stream) {
      signal.throwIfAborted();
      if (event.type === "response.output_text.delta") {
        bytes += new TextEncoder().encode(event.delta).byteLength;
        agentAssert(bytes <= agentLimits.responseBytes, "repository_response_limit", 413);
        onText?.(event.delta);
      } else if (["response.completed", "response.incomplete", "response.failed"].includes(event.type)
        && "response" in event) { response = event.response; break; }
      else if (event.type === "error") throw Error("repository_provider_stream_failed");
    }
    signal.throwIfAborted();
    agentAssert(response, "repository_provider_stream_incomplete", 502);
    return response;
  } finally { stream.controller.abort(); }
}
