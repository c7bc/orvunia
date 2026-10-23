import OpenAI, { toFile } from "openai";
import type {
  TranscriptionAdapter,
  TranscriptionConnection,
} from "./domain.ts";
import { boundedFetch, checked } from "./http.ts";
import type { HttpFetch } from "./http.ts";
import { providerRecord } from "./json.ts";
import { assemblyTranscription } from "./assemblyai.ts";

export function transcription(
  connection: TranscriptionConnection,
  transport: HttpFetch,
): TranscriptionAdapter {
  const request = boundedFetch(transport);
  if (connection.provider === "assemblyai")
    return assemblyTranscription(connection, request);
  return {
    async transcribe(input, signal) {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
      if (connection.provider === "deepgram") {
        const url = new URL(connection.baseUrl.replace(/\/$/, "") + "/listen");
        url.searchParams.set("model", connection.model);
        url.searchParams.set("smart_format", "true");
        if (input.language !== "auto")
          url.searchParams.set("language", input.language);
        else url.searchParams.set("detect_language", "true");
        const response = await checked(
          await request(url, {
            method: "POST",
            signal: deadline,
            headers: {
              Authorization: `Token ${connection.apiKey ?? ""}`,
              "content-type": input.mime,
            },
            body: new Uint8Array(input.data),
          }),
        );
        const result = providerRecord(await response.json());
        const channels = providerRecord(result.results).channels;
        if (!Array.isArray(channels) || !channels[0]) return "";
        const alternatives = providerRecord(channels[0]).alternatives;
        if (!Array.isArray(alternatives) || !alternatives[0]) return "";
        const text = providerRecord(alternatives[0]).transcript;
        return typeof text === "string" ? text.trim() : "";
      }
      const client = new OpenAI({
        apiKey: connection.apiKey || "local",
        baseURL: connection.baseUrl,
        timeout: 60_000,
        maxRetries: 0,
        fetch: request,
      });
      const result = await client.audio.transcriptions.create(
        {
          file: await toFile(input.data, input.name, { type: input.mime }),
          model: connection.model,
          ...(input.language === "auto" ? {} : connection.provider === "openai" && connection.model === "gpt-transcribe"
            ? { languages: [input.language] } : { language: input.language }),
          prompt: input.prompt.slice(0, 1500),
        },
        { signal: deadline },
      );
      return result.text.trim();
    },
  };
}
