import { tokenUsage } from "./json.ts";
import OpenAI from "openai";
import type {
  ResponseConnection,
  GenerationProvider,
  GenerationResult,
} from "./domain.ts";
import { ProviderError } from "./domain.ts";
import { boundedFetch } from "./http.ts";
import type { HttpFetch } from "./http.ts";
import { openaiReasoning } from "./openai-reasoning.ts";

export function openaiGeneration(
  connection: ResponseConnection,
  transport: HttpFetch,
): GenerationProvider {
  const client = new OpenAI({
    apiKey: connection.apiKey || "local",
    baseURL: connection.baseUrl,
    timeout: 65_000,
    maxRetries: 0,
    fetch: boundedFetch(transport),
  });
  return {
    async answer(input, signal, onDelta) {
      if (input.images.length && !connection.vision)
        throw new ProviderError("vision_disabled", 400);
      const content: OpenAI.Responses.ResponseInputContent[] = [
        { type: "input_text", text: input.context },
      ];
      for (const image of input.images)
        content.push({
          type: "input_image",
          detail: "auto",
          image_url: `data:${image.mime};base64,${Buffer.from(image.data).toString("base64")}`,
        });
      const stream = await client.responses.create(
        {
          model: connection.model,
          instructions: input.instructions,
          input: [{ role: "user", content }],
          max_output_tokens: connection.maxTokens,
          stream: true,
          store: false,
          ...openaiReasoning(connection.model),
        },
        { signal },
      );
      let text = "",
        complete = false,
        usage: GenerationResult["usage"];
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          text += event.delta;
          if (text.length > 512 * 1024)
            throw new ProviderError("provider_unavailable");
          onDelta(event.delta);
        }
        if (event.type === "response.completed") {
          complete = true;
          if (event.response.usage)
            usage = tokenUsage(
              event.response.usage.input_tokens,
              event.response.usage.output_tokens,
            );
        }
        if (event.type === "response.failed" || event.type === "error")
          throw new ProviderError("provider_unavailable");
        if (event.type === "response.incomplete")
          throw new ProviderError("provider_incomplete");
      }
      if (!complete || !text.trim())
        throw new ProviderError("provider_unavailable");
      return { text, model: connection.model, ...(usage ? { usage } : {}) };
    },
  };
}
