import type { GenerationProvider, ResponseConnection } from "./domain.ts";
import { openaiGeneration } from "./openai.ts";
import { compatibleGeneration } from "./chat.ts";
import { anthropicGeneration } from "./anthropic.ts";
import { providerFailure } from "./json.ts";
import type { HttpFetch } from "./http.ts";

export function generation(
  connection: ResponseConnection,
  transport: HttpFetch,
): GenerationProvider {
  const adapter =
    connection.provider === "openai"
      ? openaiGeneration(connection, transport)
      : connection.provider === "anthropic"
        ? anthropicGeneration(connection, transport)
        : compatibleGeneration(connection, transport);
  return {
    async answer(input, signal, delta) {
      try {
        return await adapter.answer(input, signal, delta);
      } catch (error) {
        if (signal.aborted) throw new DOMException("Interrupted", "AbortError");
        throw providerFailure(error);
      }
    },
  };
}
