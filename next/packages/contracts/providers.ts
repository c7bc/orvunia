import { z } from "zod";

export const responseProviders = [
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "ollama",
  "compatible",
] as const;
export const transcriptionProviders = [
  "openai",
  "groq",
  "deepgram",
  "assemblyai",
  "compatible",
] as const;
const endpoint = z
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"].includes(
            url.hostname,
          )))
    );
  });
const common = {
  model: z.string().trim().min(1).max(160),
  baseUrl: endpoint,
  apiKey: z.string().max(1000).optional(),
  clearKey: z.boolean().optional(),
};
export const responseConnection = z
  .object({
    ...common,
    provider: z.enum(responseProviders),
    vision: z.boolean().default(true),
    maxTokens: z.number().int().min(128).max(16000).default(3000),
  })
  .strict();
export const transcriptionConnection = z
  .object({
    ...common,
    provider: z.enum(transcriptionProviders),
    realtimeModel: z.string().max(160).default("gpt-live-transcribe"),
  })
  .strict();
export const connectionInput = z
  .object({
    response: responseConnection,
    transcription: transcriptionConnection,
  })
  .strict();
