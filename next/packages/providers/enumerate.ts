import { ProviderError } from "./domain.ts";
import { boundedFetch, checked } from "./http.ts";
import type { HttpFetch } from "./http.ts";
import { providerRecord } from "./json.ts";

export async function enumerateModels(connection: { provider: string; apiKey?: string; baseUrl: string }, transport: HttpFetch, signal?: AbortSignal) {
  if (
    !connection.apiKey &&
    !["ollama", "compatible"].includes(connection.provider)
  )
    throw new ProviderError("provider_not_configured", 400);
  if (["deepgram", "assemblyai"].includes(connection.provider))
    throw new ProviderError("provider_request", 400);
  const headers: Record<string, string> =
    connection.provider === "anthropic"
      ? { "x-api-key": connection.apiKey ?? "", "anthropic-version": "2023-06-01" }
      : { Authorization: `Bearer ${connection.apiKey || "local"}` };
  const response = await checked(
    await boundedFetch(transport)(
      connection.baseUrl.replace(/\/$/, "") + "/models",
      {
        headers,
        signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]),
      },
    ),
  );
  const value = providerRecord(await response.json());
  const data = Array.isArray(value.data) ? value.data : [];
  return {
    models: data
      .flatMap((item) => {
        const model = providerRecord(item).id;
        return typeof model === "string" &&
          model.length > 0 &&
          model.length <= 160
          ? [model]
          : [];
      })
      .slice(0, 500),
  };
}
