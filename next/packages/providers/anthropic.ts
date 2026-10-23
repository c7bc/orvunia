import type {
  ResponseConnection,
  GenerationProvider,
  GenerationResult,
} from "./domain.ts";
import { ProviderError } from "./domain.ts";
import { boundedFetch, checked } from "./http.ts";
import type { HttpFetch } from "./http.ts";
import { providerRecord, tokenCount, tokenUsage } from "./json.ts";
import { sseEvents } from "./sse.ts";

export function anthropicGeneration(
  connection: ResponseConnection,
  transport: HttpFetch,
): GenerationProvider {
  const request = boundedFetch(transport);
  return {
    async answer(input, signal, onDelta) {
      if (input.images.length && !connection.vision)
        throw new ProviderError("vision_disabled", 400);
      const content: Record<string, unknown>[] = [
        { type: "text", text: input.context },
      ];
      for (const image of input.images)
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mime,
            data: Buffer.from(image.data).toString("base64"),
          },
        });
      const response = await checked(
        await request(connection.baseUrl.replace(/\/$/, "") + "/messages", {
          method: "POST",
          signal: AbortSignal.any([signal, AbortSignal.timeout(65_000)]),
          headers: {
            "content-type": "application/json",
            "x-api-key": connection.apiKey ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: connection.model,
            system: input.instructions,
            max_tokens: connection.maxTokens,
            stream: true,
            messages: [{ role: "user", content }],
          }),
        }),
      );
      let text = "",
        complete = false,
        usage: GenerationResult["usage"],
        inputTokens: number | undefined;
      for await (const frame of sseEvents(response)) {
        const event = providerRecord(JSON.parse(frame));
        if (event.type === "error")
          throw new ProviderError("provider_unavailable");
        if (event.type === "message_start") {
          const initial = providerRecord(providerRecord(event.message).usage);
          inputTokens = tokenCount(initial.input_tokens);
        }
        if (event.type === "content_block_delta") {
          const delta = providerRecord(event.delta);
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            text += delta.text;
            if (text.length > 512 * 1024)
              throw new ProviderError("provider_unavailable");
            onDelta(delta.text);
          }
        }
        if (event.type === "message_delta") {
          if (providerRecord(event.delta).stop_reason === "max_tokens")
            throw new ProviderError("provider_incomplete");
          if (event.usage)
            usage = tokenUsage(
              inputTokens,
              providerRecord(event.usage).output_tokens,
            );
        }
        if (event.type === "message_stop") complete = true;
      }
      if (!complete || !text.trim())
        throw new ProviderError("provider_unavailable");
      return { text, model: connection.model, ...(usage ? { usage } : {}) };
    },
  };
}
