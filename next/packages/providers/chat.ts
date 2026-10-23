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

export function compatibleGeneration(
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
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: "text", text: input.context },
      ];
      for (const image of input.images)
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${image.mime};base64,${Buffer.from(image.data).toString("base64")}`,
          },
        });
      const stream = await client.chat.completions.create(
        {
          model: connection.model,
          messages: [
            { role: "system", content: input.instructions },
            { role: "user", content },
          ],
          max_tokens: connection.maxTokens,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      );
      let text = "",
        complete = false,
        usage: GenerationResult["usage"];
      for await (const event of stream) {
        const part = event.choices[0],
          delta = part?.delta.content;
        if (delta) {
          text += delta;
          if (text.length > 512 * 1024)
            throw new ProviderError("provider_unavailable");
          onDelta(delta);
        }
        if (part?.finish_reason === "length")
          throw new ProviderError("provider_incomplete");
        if (part?.finish_reason === "stop") complete = true;
        if (event.usage)
          usage = tokenUsage(
            event.usage.prompt_tokens,
            event.usage.completion_tokens,
          );
      }
      if (!complete || !text.trim())
        throw new ProviderError("provider_unavailable");
      return { text, model: connection.model, ...(usage ? { usage } : {}) };
    },
  };
}
