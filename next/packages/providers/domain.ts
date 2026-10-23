export type ResponseProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "openrouter"
  | "ollama"
  | "compatible";
export type TranscriptionProvider =
  "openai" | "groq" | "deepgram" | "assemblyai" | "compatible";
type Connection = { model: string; baseUrl: string; apiKey?: string };
export type ResponseConnection = Connection & {
  provider: ResponseProvider;
  vision: boolean;
  maxTokens: number;
};
export type TranscriptionConnection = Connection & {
  provider: TranscriptionProvider;
  realtimeModel: string;
};
export type Connections = {
  response: ResponseConnection;
  transcription: TranscriptionConnection;
};
export type ConnectionKind = keyof Connections;
export type GenerationRequest = {
  instructions: string;
  context: string;
  images: { mime: string; data: Uint8Array }[];
};
export type GenerationResult = {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
};
export interface GenerationProvider {
  answer(
    input: GenerationRequest,
    signal: AbortSignal,
    delta: (text: string) => void,
  ): Promise<GenerationResult>;
}
export type AudioInput = {
  data: Uint8Array;
  name: string;
  mime: string;
  language: string;
  prompt: string;
};
export interface TranscriptionAdapter {
  transcribe(input: AudioInput, signal: AbortSignal): Promise<string>;
}
export interface ConnectionRepository {
  read(): Promise<Connections | null>;
  write(connections: Connections): Promise<void>;
}
export interface SecretVault {
  seal(value: string): Promise<string>;
  open(value: string): Promise<string>;
}
export class ProviderError extends Error {
  constructor(
    readonly code:
      | "provider_unavailable"
      | "provider_auth"
      | "provider_limit"
      | "provider_request"
      | "provider_incomplete"
      | "vision_disabled"
      | "provider_not_configured"
      | "provider_settings_unreadable"
      | "original_provider_changed",
    readonly status = 502,
  ) {
    super(code);
  }
}
