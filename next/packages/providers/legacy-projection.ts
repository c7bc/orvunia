import type { Configuration } from "../connections/domain.ts";
import type { ConnectionService } from "../connections/service.ts";
import type { Connections, ResponseProvider, TranscriptionProvider } from "./domain.ts";
import { ProviderError } from "./domain.ts";
import { responseProviders, transcriptionProviders } from "../contracts/providers.ts";

export async function legacyProjection(service: ConnectionService, defaults: Connections) {
  const configuration = await service.configuration();
  const result = structuredClone(defaults);
  for (const role of ["response", "transcription"] as const) {
    const binding = configuration.bindings[role === "response" ? "text" : role];
    if (binding.kind !== "api") continue;
    const connection = await service.effective(binding.connectionId);
    if (role === "response") {
      if (!(responseProviders as readonly string[]).includes(connection.provider))
        throw new ProviderError("provider_settings_unreadable", 503);
      result.response = { provider: connection.provider as ResponseProvider,
        model: connection.model, baseUrl: connection.baseUrl, apiKey: connection.apiKey,
        maxTokens: connection.parameters.maxTokens ?? 3000,
        vision: configuration.bindings.vision.kind === "shared" };
    } else {
      if (!(transcriptionProviders as readonly string[]).includes(connection.provider))
        throw new ProviderError("provider_settings_unreadable", 503);
      result.transcription = { provider: connection.provider as TranscriptionProvider,
        model: connection.model, baseUrl: connection.baseUrl, apiKey: connection.apiKey,
        realtimeModel: connection.parameters.realtimeModel ?? "" };
    }
  }
  return { connections: result, configuration };
}
export function apiBinding(configuration: Configuration, role: keyof Connections) {
  return configuration.bindings[role === "response" ? "text" : role].kind === "api";
}
