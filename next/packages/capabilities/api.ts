import type { ConnectionService } from "../connections/service.ts";
import type { ResponseConnection, TranscriptionConnection } from "../providers/domain.ts";
import { CapabilityError, type ApiCapability } from "./domain.ts";

const responseProviders = new Set(["openai", "anthropic", "gemini", "groq", "openrouter", "ollama", "compatible"]);
const transcriptionProviders = new Set(["openai", "groq", "deepgram", "assemblyai", "compatible"]);
async function credentials(target: ApiCapability, connections: ConnectionService): Promise<string> {
  const current = await connections.effective(target.connectionId);
  if (current.provider !== target.provider || current.baseUrl.replace(/\/+$/, "") !== target.baseUrl.replace(/\/+$/, ""))
    throw new CapabilityError("original_provider_changed");
  if (!current.apiKey && !["compatible", "ollama"].includes(current.provider))
    throw new CapabilityError("provider_not_configured", 503);
  return current.apiKey;
}
export async function responseConnection(target: ApiCapability, connections: ConnectionService, vision: boolean): Promise<ResponseConnection> {
  if (!responseProviders.has(target.provider)) throw new CapabilityError("generation_provider_unsupported", 422);
  return { provider: target.provider as ResponseConnection["provider"], baseUrl: target.baseUrl, model: target.model,
    apiKey: await credentials(target, connections), vision, maxTokens: target.parameters.maxTokens ?? 2200 };
}
export async function transcriptionConnection(target: ApiCapability, connections: ConnectionService): Promise<TranscriptionConnection> {
  if (!transcriptionProviders.has(target.provider)) throw new CapabilityError("transcription_provider_unsupported", 422);
  return { provider: target.provider as TranscriptionConnection["provider"], baseUrl: target.baseUrl, model: target.model,
    apiKey: await credentials(target, connections), realtimeModel: target.parameters.realtimeModel ?? "" };
}
